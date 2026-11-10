import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError, get, post } from '../../lib/apiClient';
import { PageHeader } from '../layout/PageHeader';
import { AccessBitacoraView } from '../admin/AccessBitacoraView';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

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
      const params = new URLSearchParams({ page: '1', pageSize: '20' });
      if (isAdmin) params.set('communityId', communityId);
      const result = await get<{ items: ShiftHistoryItem[] }>(
        `/api/guard/shifts?${params.toString()}`,
      );
      setHistory(result.data.items);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [communityId, isAdmin]);

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
          isGuard ? (
            <Button variant="outline" onClick={() => loadCurrent()}>
              Actualizar
            </Button>
          ) : undefined
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

      {currentAccessPointId ? (
        <AccessBitacoraView
          communityId={communityId}
          accessPointId={currentAccessPointId}
          compact
        />
      ) : (
        <div className="rounded-4xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Seleccioná un acceso para ver su bitácora.
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-heading text-lg font-bold tracking-tight">Historial de turnos</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay turnos registrados.</p>
        ) : (
          <div className="rounded-4xl border border-border bg-card">
            <Table>
              <TableHeader>
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
      </div>
    </div>
  );
}
