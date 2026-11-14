import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError, get, post } from '../../lib/apiClient';
import { useBitacoraStream } from '../../lib/use-bitacora-stream';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface CommunityOption {
  id: string;
  name: string;
}

interface AccessPointOption {
  id: string;
  name: string;
  active: boolean;
}

interface BitacoraEntryRow {
  id: string;
  communityId: string;
  accessPointId: string;
  accessPointName: string;
  destinationLocationUnitId: string | null;
  destinationPath: string | null;
  authorizedByPersonId: string | null;
  authorizedByName: string | null;
  shiftId: string | null;
  type: string;
  source: string;
  authorName: string | null;
  passId: string | null;
  passScanId: string | null;
  summary: string;
  missingExitAlert?: boolean;
  details: Record<string, unknown>;
  commentCount: number;
  createdAt: string;
}

interface BitacoraCommentRow {
  id: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

interface BitacoraDetail extends BitacoraEntryRow {
  comments: BitacoraCommentRow[];
}

/** How often the board asks whether a new movement was recorded. */
// Events arrive through the stream; this is only the fallback in case one is
// missed, so it can be slow.
const BITACORA_POLL_MS = 30_000;

interface AccessBitacoraViewProps {
  communityId?: string | null;
  accessPointId?: string | null;
  compact?: boolean;
  /**
   * Bump this value to refetch the current page. It is a deliberate retrigger:
   * the filters and the pagination stay where the user left them, unlike a
   * remount, which would reset them.
   */
  refreshToken?: number;
  /**
   * Ask the server periodically whether a new movement was recorded. Off by
   * default: the guard panel already polls its own way, and only standalone
   * boards (analysis) need it.
   */
  poll?: boolean;
}

const typeLabels: Record<string, string> = {
  pass_entry: 'Ingreso',
  pass_exit: 'Egreso',
  pass_rejected: 'Rechazo',
  scan_denied: 'Escaneo denegado',
  shift_start: 'Inicio de turno',
  shift_end: 'Fin de turno',
  manual: 'Manual',
};

/**
 * The board never shows the shift events: shifts have their own tab and their
 * start and end entries only duplicated that table. Everything else stays,
 * including the manual notes the guard writes during the shift.
 */
const HIDDEN_EVENT_TYPES = ['shift_start', 'shift_end'];

/**
 * The type filter applies the exclusion on every request and narrows to one
 * single event type when the user picks one. The exclusion travels as a comma
 * separated list because the API takes one type per request.
 */
function applyTypeFilter(params: URLSearchParams, type: string) {
  params.set('excludeTypes', HIDDEN_EVENT_TYPES.join(','));
  if (type !== 'all') params.set('type', type);
}

/** The shift events are hidden on this tab, so they are not offered either. */
const selectableTypeLabels = Object.entries(typeLabels).filter(
  ([value]) => !HIDDEN_EVENT_TYPES.includes(value),
);

const typeVariants: Record<
  string,
  'default' | 'secondary' | 'warning' | 'destructive' | 'outline'
> = {
  pass_entry: 'default',
  pass_exit: 'secondary',
  pass_rejected: 'destructive',
  scan_denied: 'warning',
  shift_start: 'outline',
  shift_end: 'outline',
  manual: 'secondary',
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}

function formatDate(value: string): string {
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

export function AccessBitacoraView({
  communityId: fixedCommunityId,
  accessPointId: fixedAccessPointId,
  compact = false,
  refreshToken = 0,
  poll = false,
}: AccessBitacoraViewProps) {
  const { activeMembership } = useAuth();
  const isOrgAdmin = activeMembership?.role === 'org_admin';
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [communityId, setCommunityId] = useState<string | null>(
    fixedCommunityId ?? activeMembership?.communityId ?? null,
  );
  const [accessPoints, setAccessPoints] = useState<AccessPointOption[]>([]);
  const [accessPointId, setAccessPointId] = useState<string>(fixedAccessPointId ?? 'all');
  const [type, setType] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [items, setItems] = useState<BitacoraEntryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  /** Last total seen by the poll, used to tell "nothing new" from "new row". */
  const lastTotal = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BitacoraDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualAccessPointId, setManualAccessPointId] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [manualDetails, setManualDetails] = useState('');

  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCommunityId(fixedCommunityId ?? activeMembership?.communityId ?? null);
  }, [fixedCommunityId, activeMembership?.communityId]);

  useEffect(() => {
    setAccessPointId(fixedAccessPointId ?? 'all');
  }, [fixedAccessPointId]);

  useEffect(() => {
    if (!isOrgAdmin || fixedCommunityId) return;
    let cancelled = false;
    get<CommunityOption[]>('/api/communities')
      .then((result) => {
        if (cancelled) return;
        setCommunities(result.data);
        setCommunityId((current) => current ?? result.data[0]?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [isOrgAdmin, fixedCommunityId]);

  useEffect(() => {
    if (!communityId) {
      setAccessPoints([]);
      return;
    }
    let cancelled = false;
    get<{ items: AccessPointOption[] }>(
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

  const load = useCallback(async () => {
    if (!communityId) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      communityId,
    });
    if (accessPointId !== 'all') params.set('accessPointId', accessPointId);
    applyTypeFilter(params, type);
    if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
    try {
      const result = await get<{
        items: BitacoraEntryRow[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/api/bitacora?${params.toString()}`);
      setItems(result.data.items);
      setTotal(result.data.total);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [communityId, accessPointId, type, from, to, page, pageSize]);

  useEffect(() => {
    load();
    // `refreshToken` intentionally retriggers the fetch: the parent asks for
    // fresh rows after an action taken outside this component.
  }, [load, refreshToken]);

  /**
   * This board is written by the guard app, so the only way to notice a new
   * movement is to ask. Fetching the page itself would move ~13 KB per tick;
   * asking for a single row costs ~685 bytes and only triggers the real fetch
   * when the total changed.
   */
  useEffect(() => {
    if (!poll || !communityId) return;
    const community = communityId;
    let cancelled = false;
    // Changing filters means a different table: start from a clean baseline so
    // the first probe is not mistaken for "something happened".
    lastTotal.current = null;

    async function check() {
      if (document.visibilityState !== 'visible') return;
      const params = new URLSearchParams({ page: '1', pageSize: '1', communityId: community });
      if (accessPointId !== 'all') params.set('accessPointId', accessPointId);
      applyTypeFilter(params, type);
      if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
      if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
      try {
        const result = await get<{ total: number }>(`/api/bitacora?${params.toString()}`);
        if (cancelled) return;
        const next = result.data.total;
        if (lastTotal.current !== null && next !== lastTotal.current) {
          await load();
        }
        lastTotal.current = next;
      } catch {
        // A failed probe is not worth a banner: the next tick retries.
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
  }, [poll, communityId, accessPointId, type, from, to, load]);

  /**
   * Live updates: every new entry of the community reloads the visible page, so
   * the table reacts to a scan or a shift change without waiting for the fallback
   * poll below.
   */
  useBitacoraStream({
    communityId,
    onEntry: () => {
      void load();
    },
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Records can disappear while a page is open (a filter change, or the poll
  // noticing a different total). Landing on page 7 of 4 shows an empty table with
  // no way forward, so fall back to the last page that still exists.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const activeAccessPoints = useMemo(
    () => accessPoints.filter((item) => item.active),
    [accessPoints],
  );

  async function openDetail(entry: BitacoraEntryRow) {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelected(null);
    setComment('');
    try {
      const result = await get<BitacoraDetail>(`/api/bitacora/${entry.id}`);
      setSelected(result.data);
    } catch (err) {
      setError(errorMessage(err));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function addComment() {
    if (!selected || !comment.trim()) return;
    setCommenting(true);
    setError(null);
    try {
      await post(`/api/bitacora/${selected.id}/comments`, { body: comment.trim() });
      const result = await get<BitacoraDetail>(`/api/bitacora/${selected.id}`);
      setSelected(result.data);
      setComment('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCommenting(false);
    }
  }

  async function saveManual() {
    if (!manualSummary.trim()) return;
    setManualSaving(true);
    setError(null);
    try {
      let details: Record<string, unknown> | undefined;
      if (manualDetails.trim()) {
        details = JSON.parse(manualDetails) as Record<string, unknown>;
      }
      await post('/api/bitacora', {
        accessPointId: manualAccessPointId || undefined,
        summary: manualSummary.trim(),
        details,
      });
      setManualOpen(false);
      setManualSummary('');
      setManualDetails('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setManualSaving(false);
    }
  }

  return (
    <div className={compact ? 'space-y-4' : 'p-6 space-y-6 overflow-y-auto'}>
      {!compact && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-bold tracking-tight">Bitácora de accesos</h2>
            <p className="text-sm text-muted-foreground">
              Registro inmutable por lugar físico. Solo se agregan comentarios.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setManualAccessPointId(
                accessPointId !== 'all' ? accessPointId : (activeAccessPoints[0]?.id ?? ''),
              );
              setManualOpen(true);
            }}
            disabled={activeAccessPoints.length === 0}
          >
            Agregar novedad
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {isOrgAdmin && !fixedCommunityId && (
          <div className="space-y-1">
            <Label>Comunidad</Label>
            <Select
              value={communityId ?? ''}
              onValueChange={(value) => {
                setCommunityId(value);
                setAccessPointId('all');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Selecciona una comunidad" />
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
        )}
        {!fixedAccessPointId && (
          <div className="space-y-1">
            <Label>Acceso</Label>
            <Select
              value={accessPointId}
              onValueChange={(value) => {
                setAccessPointId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los accesos</SelectItem>
                {accessPoints.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                    {!item.active ? ' (inactivo)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {selectableTypeLabels.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Desde</Label>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Hasta</Label>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setType('all');
            setFrom('');
            setTo('');
            setAccessPointId(fixedAccessPointId ?? 'all');
            setPage(1);
          }}
        >
          Limpiar
        </Button>
        {compact && (
          <Button
            type="button"
            onClick={() => {
              setManualAccessPointId(
                accessPointId !== 'all' ? accessPointId : (activeAccessPoints[0]?.id ?? ''),
              );
              setManualOpen(true);
            }}
            disabled={activeAccessPoints.length === 0}
          >
            Agregar novedad
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-4xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No hay movimientos para los filtros seleccionados.
        </div>
      ) : (
        <div className="max-h-[55vh] overflow-auto rounded-4xl border border-border bg-card">
          <Table>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Acceso</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Autorizó</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Comentarios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(entry)}
                >
                  <TableCell>{formatDate(entry.createdAt)}</TableCell>
                  <TableCell>{entry.accessPointName}</TableCell>
                  <TableCell>
                    <Badge variant={typeVariants[entry.type] ?? 'secondary'}>
                      {typeLabels[entry.type] ?? entry.type}
                    </Badge>
                    {entry.missingExitAlert ? (
                      <Badge variant="destructive">Sin salida</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">{entry.summary}</TableCell>
                  <TableCell>{entry.destinationPath ?? '—'}</TableCell>
                  <TableCell>{entry.authorizedByName ?? '—'}</TableCell>
                  <TableCell>{entry.authorName ?? 'Sistema'}</TableCell>
                  <TableCell>{entry.commentCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          Página {page} de {totalPages} · {total} movimientos
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Filas por página</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-20" aria-label="Filas por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="35">35</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            ←
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Página siguiente"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            →
          </Button>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del movimiento</DialogTitle>
            <DialogDescription>
              La entrada original no se puede editar. Puedes agregar un comentario.
            </DialogDescription>
          </DialogHeader>
          {detailLoading || !selected ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Acceso:</span> {selected.accessPointName}
                </p>
                <p>
                  <span className="text-muted-foreground">Tipo:</span>{' '}
                  {typeLabels[selected.type] ?? selected.type}
                </p>
                <p>
                  <span className="text-muted-foreground">Autor:</span>{' '}
                  {selected.authorName ?? 'Sistema'}
                </p>
                <p>
                  <span className="text-muted-foreground">Destino:</span>{' '}
                  {selected.destinationPath ?? '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">Autorizó:</span>{' '}
                  {selected.authorizedByName ?? '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">Fecha:</span>{' '}
                  {formatDate(selected.createdAt)}
                </p>
                <p>
                  <span className="text-muted-foreground">Origen:</span> {selected.source}
                </p>
                <p>
                  <span className="text-muted-foreground">Turno:</span> {selected.shiftId ?? '—'}
                </p>
              </div>
              <p className="rounded-3xl bg-muted/50 px-4 py-3 text-sm">{selected.summary}</p>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">DETALLE</p>
                <pre className="max-h-56 overflow-auto rounded-3xl bg-muted/50 p-4 text-xs">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  COMENTARIOS ({selected.comments.length})
                </p>
                {selected.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin comentarios.</p>
                ) : (
                  selected.comments.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-border px-4 py-3">
                      <p className="text-sm">{item.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.authorName ?? 'Sistema'} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                  ))
                )}
                <div className="flex gap-2">
                  <Input
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Agregar comentario"
                  />
                  <Button
                    type="button"
                    onClick={addComment}
                    disabled={commenting || !comment.trim()}
                  >
                    {commenting ? 'Enviando…' : 'Comentar'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar novedad</DialogTitle>
            <DialogDescription>
              La novedad queda asociada al acceso y no se puede editar después.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Acceso</Label>
              <Select value={manualAccessPointId} onValueChange={setManualAccessPointId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un acceso" />
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
            <div className="space-y-1">
              <Label htmlFor="manual-summary">Resumen</Label>
              <Input
                id="manual-summary"
                value={manualSummary}
                onChange={(event) => setManualSummary(event.target.value)}
                placeholder="Paquete para A-101"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="manual-details">Detalle JSON (opcional)</Label>
              <textarea
                id="manual-details"
                className="min-h-24 w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                value={manualDetails}
                onChange={(event) => setManualDetails(event.target.value)}
                placeholder='{"paquete":"A-101","empresa":"Moto"}'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={saveManual}
              disabled={manualSaving || !manualSummary.trim() || !manualAccessPointId}
            >
              {manualSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
