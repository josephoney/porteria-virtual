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
import { DetailField, DetailGrid } from '../ui/detail-field';

interface CommunityOption {
  id: string;
  name: string;
}

interface AccessPointOption {
  id: string;
  name: string;
  active: boolean;
}

interface GuardOption {
  id: string;
  name: string;
}

type BitacoraResultValue = 'authorized' | 'denied' | 'code_failure' | 'observation';

interface BitacoraEntryRow {
  id: string;
  communityId: string;
  communityName: string | null;
  accessPointId: string;
  accessPointName: string;
  destinationLocationUnitId: string | null;
  destinationPath: string | null;
  authorizedByPersonId: string | null;
  authorizedByName: string | null;
  shiftId: string | null;
  type: string;
  result: BitacoraResultValue;
  source: string;
  guardPersonId: string | null;
  guardName: string | null;
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
  pass_entry: 'Ingresó',
  pass_exit: 'Salió',
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

/** Resultado legible: siempre etiqueta + ícono, nunca solo color. */
const resultConfig: Record<
  BitacoraResultValue,
  {
    label: string;
    variant: 'default' | 'secondary' | 'warning' | 'destructive' | 'outline';
  }
> = {
  authorized: { label: 'Autorizado', variant: 'default' },
  denied: { label: 'Denegado', variant: 'destructive' },
  code_failure: { label: 'Falla de código', variant: 'warning' },
  observation: { label: 'Observación', variant: 'secondary' },
};

const resultOptions: Array<{ value: BitacoraResultValue | 'all'; label: string }> = [
  { value: 'all', label: 'Todos los resultados' },
  { value: 'authorized', label: 'Autorizado' },
  { value: 'denied', label: 'Denegado' },
  { value: 'code_failure', label: 'Falla de código' },
  { value: 'observation', label: 'Observación' },
];

function ResultIcon({ result }: { result: BitacoraResultValue }) {
  if (result === 'authorized') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }
  if (result === 'denied') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    );
  }
  if (result === 'code_failure') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h16v16H4z" />
      <path d="M8 9h8M8 13h6" />
    </svg>
  );
}

function ResultBadge({ result }: { result: BitacoraResultValue }) {
  const config = resultConfig[result] ?? resultConfig.observation;
  return (
    <Badge variant={config.variant}>
      <ResultIcon result={result} />
      {config.label}
    </Badge>
  );
}

function entryVisitorName(entry: BitacoraEntryRow): string | null {
  const details = asRecord(entry.details);
  const visitor = asRecord(details?.visitor);
  return (
    [readText(visitor?.firstName), readText(visitor?.lastName)].filter(Boolean).join(' ') || null
  );
}

function entryVehicle(entry: BitacoraEntryRow): string | null {
  return readText(asRecord(entry.details)?.vehiclePlate);
}

/** Valor del selector que representa "todas las comunidades del alcance". */
const ALL_COMMUNITIES = 'all';

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

function formatDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/** The `details` payload is free-form JSON: read it defensively. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function technicalJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2) ?? '{}';
  } catch {
    return 'No se pudieron mostrar los detalles técnicos.';
  }
}

/** Reason codes the scan flow stores in `details.reason`. */
const reasonLabels: Record<string, string> = {
  denied_by_guard: 'Denegado por el guardia',
  pass_used: 'Pase ya utilizado',
  revoked: 'Pase revocado',
  expired: 'Pase vencido',
  not_valid_now: 'Fuera de vigencia',
  out_of_days: 'Día no autorizado',
  out_of_schedule: 'Fuera del horario permitido',
  daily_uses_exhausted: 'Sin usos disponibles hoy',
  wrong_direction: 'Sentido de acceso incorrecto',
  token_already_used: 'QR ya utilizado',
};

export function AccessBitacoraView({
  communityId: fixedCommunityId,
  accessPointId: fixedAccessPointId,
  compact = false,
  refreshToken = 0,
  poll = false,
}: AccessBitacoraViewProps) {
  const { user, activeMembership } = useAuth();
  const isOrgAdmin = activeMembership?.role === 'org_admin';
  const isPlatformContext = Boolean(user?.isPlatformAdmin && activeMembership?.id === 'platform');
  const canPickCommunity = !fixedCommunityId && (isOrgAdmin || isPlatformContext);
  const canAddManual =
    !isPlatformContext &&
    ['org_admin', 'community_admin', 'guard'].includes(activeMembership?.role ?? '');
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [communityFilter, setCommunityFilter] = useState<string>(
    fixedCommunityId ?? activeMembership?.communityId ?? ALL_COMMUNITIES,
  );
  const [accessPoints, setAccessPoints] = useState<AccessPointOption[]>([]);
  const [accessPointId, setAccessPointId] = useState<string>(fixedAccessPointId ?? 'all');
  const [type, setType] = useState<string>('all');
  const [result, setResult] = useState<BitacoraResultValue | 'all'>('all');
  const [guards, setGuards] = useState<GuardOption[]>([]);
  const [guardId, setGuardId] = useState<string>('all');
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

  // `null` means "todas las comunidades del alcance": plataforma ve todas y
  // org_admin ve las de su organización.
  const communityId = communityFilter === ALL_COMMUNITIES ? null : communityFilter;

  useEffect(() => {
    setCommunityFilter(fixedCommunityId ?? activeMembership?.communityId ?? ALL_COMMUNITIES);
  }, [fixedCommunityId, activeMembership?.communityId]);

  useEffect(() => {
    setAccessPointId(fixedAccessPointId ?? 'all');
  }, [fixedAccessPointId]);

  useEffect(() => {
    if (!canPickCommunity) return;
    let cancelled = false;
    const request = isPlatformContext
      ? get<{ data: CommunityOption[] }>('/api/platform/communities?pageSize=100').then(
          (response) => response.data.data,
        )
      : get<CommunityOption[]>('/api/communities').then((response) => response.data);
    request
      .then((result) => {
        if (!cancelled) setCommunities(result);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [canPickCommunity, isPlatformContext]);

  useEffect(() => {
    if (!communityId) {
      setAccessPoints([]);
      return;
    }
    let cancelled = false;
    const includeInactive = isOrgAdmin || isPlatformContext ? 'true' : 'false';
    get<{ items: AccessPointOption[] }>(
      `/api/communities/${communityId}/access-points?includeInactive=${includeInactive}`,
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
  }, [communityId, isOrgAdmin, isPlatformContext]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (communityId) params.set('communityId', communityId);
    const search = params.toString();
    get<{ items: GuardOption[] }>(`/api/bitacora/guards${search ? `?${search}` : ''}`)
      .then((result) => {
        if (!cancelled) setGuards(result.data.items);
      })
      .catch(() => {
        // The filter is optional: a failure must not block the log.
        if (!cancelled) setGuards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  const buildQueryParams = useCallback(
    (pageValue: number, pageSizeValue: number) => {
      const params = new URLSearchParams({
        page: String(pageValue),
        pageSize: String(pageSizeValue),
      });
      if (communityId) params.set('communityId', communityId);
      if (accessPointId !== 'all') params.set('accessPointId', accessPointId);
      if (guardId !== 'all') params.set('guardId', guardId);
      if (result !== 'all') params.set('result', result);
      applyTypeFilter(params, type);
      if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
      if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
      return params;
    },
    [communityId, accessPointId, guardId, result, type, from, to],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = buildQueryParams(page, pageSize);
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
  }, [buildQueryParams, page, pageSize]);

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
    if (!poll) return;
    let cancelled = false;
    // Changing filters means a different table: start from a clean baseline so
    // the first probe is not mistaken for "something happened".
    lastTotal.current = null;

    async function check() {
      if (document.visibilityState !== 'visible') return;
      const params = buildQueryParams(1, 1);
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
  }, [poll, buildQueryParams, load]);

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
  // La columna de comunidad solo aporta cuando la bitácora es global o abarca
  // más de una comunidad.
  const showCommunity = communityId === null;

  const selectedDetails = asRecord(selected?.details);
  const selectedVisitor = asRecord(selectedDetails?.visitor);
  const selectedVisitorName =
    [readText(selectedVisitor?.firstName), readText(selectedVisitor?.lastName)]
      .filter(Boolean)
      .join(' ') || null;
  const selectedVisitorDocument = readText(selectedVisitor?.document);
  const selectedAction = readText(selectedDetails?.action);
  const selectedActionLabel =
    selectedAction === 'entry' ? 'Ingresó' : selectedAction === 'exit' ? 'Salió' : null;
  const selectedDetailDestination = readText(selectedDetails?.destinationName);
  const selectedReason = readText(selectedDetails?.reason);
  const selectedGuardNote = readText(selectedDetails?.note);
  const selectedReasonLabel = selectedReason
    ? selectedReason === selectedGuardNote
      ? 'Denegado por el guardia (ver novedad)'
      : (reasonLabels[selectedReason] ?? selectedReason)
    : null;
  const selectedRule = readText(selectedDetails?.rule);
  const selectedVehicle = readText(selectedDetails?.vehiclePlate);

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

  function resetFilters() {
    setType('all');
    setResult('all');
    setGuardId('all');
    setFrom('');
    setTo('');
    setAccessPointId(fixedAccessPointId ?? 'all');
    setPage(1);
  }

  function changeCommunity(value: string) {
    setCommunityFilter(value);
    setAccessPointId(fixedAccessPointId ?? 'all');
    setGuardId('all');
    setPage(1);
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
            disabled={!canAddManual || activeAccessPoints.length === 0}
          >
            Agregar novedad
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {canPickCommunity && (
          <div className="space-y-1">
            <Label>Comunidad</Label>
            <Select value={communityFilter} onValueChange={changeCommunity}>
              <SelectTrigger className="w-56" aria-label="Filtrar por comunidad">
                <SelectValue placeholder="Selecciona una comunidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COMMUNITIES}>Todas las comunidades</SelectItem>
                {communities.map((community) => (
                  <SelectItem key={community.id} value={community.id}>
                    {community.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!fixedAccessPointId && communityId && (
          <div className="space-y-1">
            <Label>Acceso</Label>
            <Select
              value={accessPointId}
              onValueChange={(value) => {
                setAccessPointId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-56" aria-label="Filtrar por acceso">
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
          <Label>Resultado</Label>
          <Select
            value={result}
            onValueChange={(value) => {
              setResult(value as BitacoraResultValue | 'all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filtrar por resultado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resultOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Guardia</Label>
          <Select
            value={guardId}
            onValueChange={(value) => {
              setGuardId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-52" aria-label="Filtrar por guardia">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los guardias</SelectItem>
              {guards.map((guard) => (
                <SelectItem key={guard.id} value={guard.id}>
                  {guard.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48" aria-label="Filtrar por tipo">
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
          <Input
            type="date"
            aria-label="Filtrar desde"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label>Hasta</Label>
          <Input
            type="date"
            aria-label="Filtrar hasta"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button type="button" variant="outline" onClick={resetFilters}>
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
            disabled={!canAddManual || activeAccessPoints.length === 0}
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
                <TableHead>Hora</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Guardia</TableHead>
                <TableHead>Autorizó</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Acceso</TableHead>
                {showCommunity && <TableHead>Comunidad</TableHead>}
                <TableHead>Observación</TableHead>
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
                  <TableCell className="whitespace-nowrap">{formatDay(entry.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatTime(entry.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      <ResultBadge result={entry.result} />
                      {entry.missingExitAlert ? (
                        <Badge variant="destructive">Sin salida</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{entryVisitorName(entry) ?? '—'}</TableCell>
                  <TableCell>{entryVehicle(entry) ?? '—'}</TableCell>
                  <TableCell>{entry.guardName ?? '—'}</TableCell>
                  <TableCell>{entry.authorizedByName ?? '—'}</TableCell>
                  <TableCell>{entry.destinationPath ?? '—'}</TableCell>
                  <TableCell>{entry.accessPointName}</TableCell>
                  {showCommunity && <TableCell>{entry.communityName ?? '—'}</TableCell>}
                  <TableCell className="max-w-md whitespace-normal">{entry.summary}</TableCell>
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
              <DetailGrid>
                <DetailField label="Resultado" value={<ResultBadge result={selected.result} />} />
                <DetailField label="Comunidad" value={selected.communityName ?? '—'} />
                <DetailField label="Acceso" value={selected.accessPointName} />
                <DetailField label="Tipo" value={typeLabels[selected.type] ?? selected.type} />
                <DetailField label="Guardia" value={selected.guardName ?? '—'} />
                <DetailField label="Autorizó" value={selected.authorizedByName ?? '—'} />
                <DetailField label="Fecha" value={formatDate(selected.createdAt)} />
                <DetailField label="Origen" value={selected.source} />
                <DetailField label="Turno" value={selected.shiftId ?? '—'} />
                <DetailField
                  label="Destino"
                  value={selectedDetailDestination ?? selected.destinationPath ?? '—'}
                />
                <DetailField label="Visitante" value={selectedVisitorName ?? '—'} />
                <DetailField label="Documento" value={selectedVisitorDocument ?? '—'} />
                <DetailField label="Vehículo" value={selectedVehicle ?? '—'} />
                <DetailField label="Acción" value={selectedActionLabel ?? '—'} />
                <DetailField label="Motivo" value={selectedReasonLabel ?? '—'} />
                <DetailField label="Regla" value={selectedRule ?? '—'} span="full" />
              </DetailGrid>
              <p className="rounded-3xl bg-muted/50 px-4 py-3 text-sm">{selected.summary}</p>
              <section className="space-y-1 rounded-3xl border border-border bg-muted/30 px-4 py-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Novedad del guardia
                </h3>
                {selectedGuardNote ? (
                  <p className="whitespace-pre-wrap text-sm">{selectedGuardNote}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin novedad registrada para este movimiento.
                  </p>
                )}
              </section>
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
              <details className="rounded-3xl border border-border">
                <summary className="cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Detalles técnicos
                </summary>
                <pre className="max-h-56 overflow-auto border-t border-border bg-muted/30 p-4 text-xs">
                  {technicalJson(selected.details)}
                </pre>
              </details>
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
