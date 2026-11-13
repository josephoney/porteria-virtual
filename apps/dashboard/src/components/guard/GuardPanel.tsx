import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError, get, post } from '../../lib/apiClient';
import { useBitacoraStream } from '../../lib/use-bitacora-stream';
import { PageHeader } from '../layout/PageHeader';
import { AccessBitacoraView } from '../admin/AccessBitacoraView';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

/** How often the panel asks whether a new access movement was recorded. */
const BITACORA_POLL_MS = 15_000;

interface CommunityOption {
  id: string;
  name: string;
}

interface AccessPointRow {
  id: string;
  communityId: string;
  name: string;
  type: string;
  direction: string;
  active: boolean;
}

interface ShiftRow {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  closedReason: string | null;
}

interface SegmentRow {
  id: string;
  accessPointId: string;
  startedAt: string;
  endedAt: string | null;
  accessPointName?: string;
}

interface CurrentShiftResponse {
  shift: ShiftRow | null;
  segment: SegmentRow | null;
  accessPoint: AccessPointRow | null;
  stale: boolean;
  elapsedSeconds: number;
}

interface ShiftHistoryItem extends ShiftRow {
  segments: SegmentRow[];
  durationSeconds: number;
}

interface ActiveGuard {
  shiftId: string;
  personId: string;
  name: string;
  email: string;
  startedAt: string;
  accessPointId: string;
  accessPointName: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function GuardPanel() {
  const { user, activeMembership } = useAuth();
  const role = activeMembership?.role ?? '';
  const isGuard = role === 'guard';
  const isAdmin = ['org_admin', 'community_admin'].includes(role);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [communityId, setCommunityId] = useState<string | null>(
    activeMembership?.communityId ?? null,
  );
  const [accessPoints, setAccessPoints] = useState<AccessPointRow[]>([]);
  const [selectedAccessPointId, setSelectedAccessPointId] = useState<string>('');
  const [current, setCurrent] = useState<CurrentShiftResponse | null>(null);
  const [history, setHistory] = useState<ShiftHistoryItem[]>([]);
  const [activeGuards, setActiveGuards] = useState<ActiveGuard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bitacoraToken, setBitacoraToken] = useState(0);
  /** Last total seen by the poll, used to tell "nothing new" from "new row". */
  const lastActivityTotal = useRef<number | null>(null);
  const [boardTab, setBoardTab] = useState<'access' | 'shifts'>('access');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyTotal, setHistoryTotal] = useState(0);
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize));

  // Same fallback as the bitácora: never strand the user on a page that no
  // longer has rows.
  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  useEffect(() => {
    setCommunityId(activeMembership?.communityId ?? null);
  }, [activeMembership?.communityId]);

  useEffect(() => {
    if (!isAdmin || activeMembership?.communityId) return;
    let cancelled = false;
    get<CommunityOption[]>('/api/communities')
      .then((result) => {
        if (cancelled) return;
        setCommunities(result.data);
        setCommunityId((existing) => existing ?? result.data[0]?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, activeMembership?.communityId]);

  useEffect(() => {
    if (!communityId) {
      setAccessPoints([]);
      return;
    }
    let cancelled = false;
    get<{ items: AccessPointRow[] }>(
      `/api/communities/${communityId}/access-points?includeInactive=true`,
    )
      .then((result) => {
        if (!cancelled) setAccessPoints(result.data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  const loadCurrent = useCallback(async () => {
    if (!isGuard) {
      setCurrent(null);
      return;
    }
    try {
      const result = await get<CurrentShiftResponse>('/api/guard/shifts/current');
      setCurrent(result.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [isGuard]);

  const loadHistory = useCallback(async () => {
    if (!communityId) return;
    try {
      const params = new URLSearchParams({
        page: String(historyPage),
        pageSize: String(historyPageSize),
      });
      if (isAdmin) params.set('communityId', communityId);
      const result = await get<{ items: ShiftHistoryItem[]; total: number }>(
        `/api/guard/shifts?${params.toString()}`,
      );
      setHistory(result.data.items);
      setHistoryTotal(result.data.total);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [communityId, isAdmin, historyPage, historyPageSize]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      await Promise.all([loadCurrent(), loadHistory()]);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [loadCurrent, loadHistory]);

  const currentAccessPointId = current?.accessPoint?.id ?? selectedAccessPointId ?? undefined;

  useEffect(() => {
    if (!isAdmin || !communityId || !currentAccessPointId) {
      setActiveGuards([]);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      communityId,
      accessPointId: currentAccessPointId,
    });
    get<{ items: ActiveGuard[] }>(`/api/guard/active-guards?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setActiveGuards(result.data.items);
      })
      .catch(() => {
        if (!cancelled) setActiveGuards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, communityId, currentAccessPointId]);

  /**
   * The bitácora is written by the guard app, not by this panel, so the only
   * way to notice a decision is to ask. Fetching the page itself would move
   * 13 KB on every tick; instead we ask for a single row and compare the total,
   * which costs 685 bytes and only triggers the real fetch when it changed.
   */
  useEffect(() => {
    const community = communityId;
    const accessPoint = currentAccessPointId;
    // A guard polls only while a shift is open. An admin does not cover a post,
    // so there is no shift of their own: the selected community and access
    // point are enough to keep the board they are watching up to date.
    const needsShift = isGuard && !current?.shift?.id;
    if (!community || !accessPoint || needsShift) {
      lastActivityTotal.current = null;
      return;
    }

    // Narrow once, outside the callback: TypeScript does not carry the
    // narrowing of a nullable value into an async closure.
    const communityKey: string = community;
    const accessPointKey: string = accessPoint;

    // Start from scratch so switching access point does not compare against the
    // total of the previous one.
    lastActivityTotal.current = null;

    let cancelled = false;

    async function check() {
      // A hidden tab has nobody looking at it, so skip the tick instead of
      // spending a request on a screen that is not on screen.
      if (document.visibilityState !== 'visible') return;
      const params = new URLSearchParams({
        communityId: communityKey,
        accessPointId: accessPointKey,
        page: '1',
        pageSize: '1',
      });
      try {
        const result = await get<{ total: number }>(`/api/bitacora?${params.toString()}`);
        if (cancelled) return;
        const total = result.data.total;
        if (lastActivityTotal.current !== null && total !== lastActivityTotal.current) {
          setBitacoraToken((value) => value + 1);
        }
        lastActivityTotal.current = total;
      } catch {
        // A failed poll is not worth a banner: the manual button still works and
        // the next tick retries.
      }
    }

    void check();
    const timer = window.setInterval(() => {
      void check();
    }, BITACORA_POLL_MS);
    // Coming back to the tab should feel instant, not wait for the tick.
    document.addEventListener('visibilitychange', check);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [current?.shift?.id, communityId, currentAccessPointId, isGuard]);

  const activeAccessPoints = useMemo(
    () => accessPoints.filter((item) => item.active),
    [accessPoints],
  );
  const defaultAccessPoint = useMemo(
    () =>
      activeAccessPoints.find((item) => item.id === activeMembership?.defaultAccessPointId) ?? null,
    [activeAccessPoints, activeMembership?.defaultAccessPointId],
  );

  useEffect(() => {
    if (!current && !selectedAccessPointId) {
      setSelectedAccessPointId(defaultAccessPoint?.id ?? activeAccessPoints[0]?.id ?? '');
    }
  }, [current, selectedAccessPointId, defaultAccessPoint, activeAccessPoints]);

  async function refreshAll() {
    setBusy(true);
    setError(null);
    try {
      // The bitácora is written by the app, so the only way to see a decision
      // that was just made is to refetch it: the token below asks the child to
      // reload the current page.
      await Promise.all([loadCurrent(), loadHistory()]);
      setBitacoraToken((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  /**
   * The stream announces every new bitacora entry of the community. Opening or
   * closing a shift writes one, and so does a scan, so the history below refreshes
   * without waiting for the fallback poll or the manual button.
   */
  useBitacoraStream({
    communityId,
    onEntry: (event) => {
      if (event.type === 'shift_start' || event.type === 'shift_end') {
        void loadHistory();
      }
    },
  });

  async function startShift() {
    setBusy(true);
    setError(null);
    try {
      await post('/api/guard/shifts/start', {
        accessPointId: selectedAccessPointId || undefined,
        source: 'dashboard',
      });
      await Promise.all([loadCurrent(), loadHistory()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function changeAccessPoint() {
    if (!current?.shift || !selectedAccessPointId) return;
    setBusy(true);
    setError(null);
    try {
      await post(`/api/guard/shifts/${current.shift.id}/change-access-point`, {
        accessPointId: selectedAccessPointId,
        source: 'dashboard',
      });
      await Promise.all([loadCurrent(), loadHistory()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function endShift() {
    if (!current?.shift) return;
    if (!window.confirm('¿Cerrar el turno actual?')) return;
    setBusy(true);
    setError(null);
    try {
      await post(`/api/guard/shifts/${current.shift.id}/end`, {
        source: 'dashboard',
      });
      await Promise.all([loadCurrent(), loadHistory()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function forceClose(shift: ShiftHistoryItem) {
    if (!communityId) return;
    const reason = window.prompt('Motivo del cierre forzado:', 'Cierre administrativo');
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await post(`/api/guard/shifts/${shift.id}/force-close`, { reason });
      await Promise.all([loadCurrent(), loadHistory()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <PageHeader
        title="Guardia"
        description={
          isGuard
            ? 'Tu turno, tu acceso y la bitácora del lugar físico.'
            : 'Vista de administración de turnos y bitácora por acceso.'
        }
        actions={
          <Button variant="outline" onClick={refreshAll} disabled={busy}>
            {busy ? 'Actualizando…' : 'Actualizar'}
          </Button>
        }
      />

      {error && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isAdmin && !activeMembership?.communityId && (
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label>Comunidad</Label>
            <Select
              value={communityId ?? ''}
              onValueChange={(value) => {
                setCommunityId(value);
                setSelectedAccessPointId('');
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Seleccioná una comunidad" />
              </SelectTrigger>
              <SelectContent>
                {communities.map((community) => (
                  <SelectItem key={community.id} value={community.id}>
                    {community.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{user?.name}</p>
            <p className="text-muted-foreground">{user?.email}</p>
            <p className="text-muted-foreground">Rol: {role || '—'}</p>
            <p className="text-muted-foreground">
              Acceso default: {defaultAccessPoint?.name ?? 'Sin asignar'}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Turno actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : isGuard && current?.shift ? (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant="default">Abierto</Badge>
                  <span>
                    Acceso: <strong>{current.accessPoint?.name ?? '—'}</strong>
                  </span>
                  <span>Inicio: {formatDateTime(current.shift.startedAt)}</span>
                  <span>Transcurrido: {formatElapsed(current.elapsedSeconds)}</span>
                  {current.stale && <Badge variant="warning">Turno largo</Badge>}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label>Cambiar acceso</Label>
                    <Select value={selectedAccessPointId} onValueChange={setSelectedAccessPointId}>
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAccessPoints.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={changeAccessPoint}
                    disabled={
                      busy ||
                      !selectedAccessPointId ||
                      selectedAccessPointId === current.accessPoint?.id
                    }
                  >
                    Cambiar
                  </Button>
                  <Button variant="destructive" onClick={endShift} disabled={busy}>
                    Cerrar turno
                  </Button>
                </div>
              </>
            ) : isGuard ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No tenés un turno abierto. Elegí el acceso donde vas a estar.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label>Acceso</Label>
                    <Select value={selectedAccessPointId} onValueChange={setSelectedAccessPointId}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Seleccioná un acceso" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAccessPoints.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={startShift} disabled={busy || !selectedAccessPointId}>
                    Iniciar turno
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Como administrador podés ver los turnos activos y la bitácora, pero no iniciar un
                turno propio.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {isAdmin && currentAccessPointId && (
        <div className="rounded-4xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Guardias activos en este acceso</p>
          {activeGuards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay guardias en turno.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeGuards.map((guard) => (
                <Badge key={guard.shiftId} variant="outline">
                  {guard.name} · desde {formatDateTime(guard.startedAt)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <Tabs value={boardTab} onValueChange={(value) => setBoardTab(value as 'access' | 'shifts')}>
        <TabsList>
          <TabsTrigger value="access">Ingresos y salidas</TabsTrigger>
          <TabsTrigger value="shifts">Turnos</TabsTrigger>
        </TabsList>

        <TabsContent value="access" className="space-y-4">
          {currentAccessPointId ? (
            <AccessBitacoraView
              communityId={communityId}
              accessPointId={currentAccessPointId}
              refreshToken={bitacoraToken}
              compact
            />
          ) : (
            <div className="rounded-4xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Seleccioná un acceso para ver su bitácora.
            </div>
          )}
        </TabsContent>

        <TabsContent value="shifts" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Página {historyPage} de {historyTotalPages} · {historyTotal} turnos
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filas por página</span>
              <Select
                value={String(historyPageSize)}
                onValueChange={(value) => {
                  setHistoryPageSize(Number(value));
                  setHistoryPage(1);
                }}
              >
                <SelectTrigger className="w-24" aria-label="Filas por página de turnos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="35">35</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Página anterior de turnos"
                onClick={() => setHistoryPage((value) => Math.max(1, value - 1))}
                disabled={historyPage <= 1}
              >
                ←
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Página siguiente de turnos"
                onClick={() => setHistoryPage((value) => Math.min(historyTotalPages, value + 1))}
                disabled={historyPage >= historyTotalPages}
              >
                →
              </Button>
            </div>
          </div>
          {history.length === 0 ? (
            <p className="rounded-4xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Todavía no hay turnos registrados.
            </p>
          ) : (
            <div className="max-h-[55vh] overflow-auto rounded-4xl border border-border bg-card">
              <Table>
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                  <TableRow>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Acceso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Duración</TableHead>
                    {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((shift) => {
                    const lastSegment = shift.segments[shift.segments.length - 1];
                    return (
                      <TableRow key={shift.id}>
                        <TableCell>{formatDateTime(shift.startedAt)}</TableCell>
                        <TableCell>{formatDateTime(shift.endedAt)}</TableCell>
                        <TableCell>
                          {lastSegment?.accessPointName ?? lastSegment?.accessPointId ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>
                            {shift.status === 'open' ? 'Abierto' : 'Cerrado'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatElapsed(shift.durationSeconds)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {shift.status === 'open' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => forceClose(shift)}
                                disabled={busy}
                              >
                                Forzar cierre
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
