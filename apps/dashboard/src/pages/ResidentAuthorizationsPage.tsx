import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiFileCopyLine,
  RiFileList3Line,
  RiForbidLine,
  RiPencilLine,
  RiQrCodeLine,
  RiRefreshLine,
} from '@remixicon/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  isPermanentPass,
  type DestinationOption,
  type PassCompanion,
  type PassRecurrence,
  type PassRuleSummary,
} from '@porteria/shared';
import { ApiError, get, post } from '../lib/apiClient';
import { usePassStream } from '../lib/use-pass-stream';
import { expandableRowProps, useExpandedRow } from '../lib/use-expanded-row';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { DetailField, DetailGrid } from '../components/ui/detail-field';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { ListToolbar } from '../components/layout/ListToolbar';
import { PageHeader } from '../components/layout/PageHeader';
import { Pagination } from '../components/layout/Pagination';

type DisplayStatus = 'active' | 'used' | 'revoked' | 'expired';

interface PassDestination {
  id: string;
  name: string;
  path: string;
  kind: 'home' | 'common_area';
}

interface ResidentPass {
  id: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorDocument: string;
  companions?: PassCompanion[];
  validFrom: string;
  validUntil: string;
  createdAt: string;
  status: string;
  /** `inside` means the visitor already went through the gate. */
  presenceState?: string;
  type?: string;
  recurrence?: PassRecurrence;
  allowedDays?: number[] | null;
  timeFrom?: string | null;
  timeTo?: string | null;
  maxUses?: number;
  entryCount?: number;
  exitCount?: number;
  batchId: string | null;
  batchLabel: string | null;
  shareUrl: string | null;
  destination?: PassDestination;
  locationPath?: string;
}

/** The detail endpoint adds the server-built rule to the same row shape. */
interface PassDetail extends ResidentPass {
  rule?: PassRuleSummary;
}

interface PassQr {
  token: string;
  expiresAt: string;
}

const STATUS_LABELS: Record<DisplayStatus, string> = {
  active: 'Activa',
  used: 'Usada',
  revoked: 'Revocada',
  expired: 'Vencida',
};

const STATUS_VARIANTS: Record<DisplayStatus, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    active: 'default',
    used: 'secondary',
    revoked: 'destructive',
    expired: 'outline',
  };

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** The date inputs are local calendar days; the API receives exact instants. */
function startOfLocalDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function endOfLocalDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

/**
 * `expired` is derived, not stored: a pass only flips to that status when a
 * guard scans it, so an active pass past its window must read as `Vencida`
 * here. The list endpoint applies the same rule when filtering.
 */
function displayStatus(pass: ResidentPass): DisplayStatus {
  if (pass.status === 'active' && new Date(pass.validUntil).getTime() < Date.now()) {
    return 'expired';
  }
  return pass.status as DisplayStatus;
}

function visitorName(pass: ResidentPass) {
  return `${pass.visitorFirstName} ${pass.visitorLastName}`.trim();
}

function formatRange(from: string, until: string) {
  const start = dateFormat.format(new Date(from));
  if (isPermanentPass(until)) return `${start} → sin fecha de fin`;
  return `${start} → ${dateFormat.format(new Date(until))}`;
}

const SHORT_DAY_LABELS: Record<number, string> = {
  0: 'D',
  1: 'L',
  2: 'M',
  3: 'X',
  4: 'J',
  5: 'V',
  6: 'S',
};

/** Monday first, like the picker, even though the payload stores 0 = Sunday. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * One compact line for the history row. Default `once` passes without a time
 * window stay unlabelled so the table does not grow for legacy rows.
 */
function compactRule(pass: ResidentPass): string | null {
  const hasWindow = Boolean(pass.timeFrom && pass.timeTo);
  const recurrence = pass.recurrence ?? 'once';
  if (recurrence === 'once' && !hasWindow) return null;

  let mode: string;
  if (recurrence === 'weekly') {
    const days = WEEK_ORDER.filter((day) => pass.allowedDays?.includes(day)).map(
      (day) => SHORT_DAY_LABELS[day],
    );
    mode = days.length > 0 ? days.join(' · ') : 'Semanal';
  } else if (recurrence === 'range') {
    mode = 'Todos los días';
  } else {
    mode = 'Usos totales';
  }

  if (!hasWindow) return mode;
  return `${mode} · ${pass.timeFrom!.slice(0, 5)}–${pass.timeTo!.slice(0, 5)}`;
}

function detailUses(detail: PassDetail) {
  const rule = detail.rule;
  if (!rule) return '—';
  if (detail.type === 'entry_only') return '1 uso, se consume al entrar';
  const noun = rule.maxUses === 1 ? 'uso' : 'usos';
  if (rule.recurrence === 'once')
    return `${rule.remainingUses} de ${rule.maxUses} ${noun} disponibles`;
  return `${rule.remainingUses} de ${rule.maxUses} ${noun} hoy`;
}

export function ResidentAuthorizationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [passes, setPasses] = useState<ResidentPass[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const requestIdRef = useRef(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [batchFilter, setBatchFilter] = useState<{ id: string; label: string } | null>(() => {
    // The bulk result links here with `?batchId=…&batchLabel=…` so the lot
    // arrives already filtered.
    const batchId = searchParams.get('batchId');
    if (!batchId) return null;
    return { id: batchId, label: searchParams.get('batchLabel') ?? 'Carga masiva' };
  });
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [qrPass, setQrPass] = useState<ResidentPass | null>(null);
  const [qr, setQr] = useState<PassQr | null>(null);
  const [qrError, setQrError] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const qrTimer = useRef<number | null>(null);

  const [revokePass, setRevokePass] = useState<ResidentPass | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const passRow = useExpandedRow();
  const [detail, setDetail] = useState<PassDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const stopQrTimer = useCallback(() => {
    if (qrTimer.current !== null) {
      window.clearTimeout(qrTimer.current);
      qrTimer.current = null;
    }
  }, []);

  const loadQr = useCallback(
    async (passId: string) => {
      setQrLoading(true);
      try {
        const result = await get<PassQr>(`/api/passes/${passId}/qr`);
        setQr(result.data);
        setQrError('');
        // Refresh before the token expires so the code on screen stays valid.
        const remaining = new Date(result.data.expiresAt).getTime() - Date.now();
        const delay = Math.max(4000, remaining * 0.8);
        stopQrTimer();
        qrTimer.current = window.setTimeout(() => {
          void loadQr(passId);
        }, delay);
      } catch {
        setQrError('No pudimos generar el QR. Cierra el diálogo y revisa el estado del pase.');
        stopQrTimer();
      } finally {
        setQrLoading(false);
      }
    },
    [stopQrTimer],
  );

  useEffect(() => {
    if (!qrPass) {
      stopQrTimer();
      setQr(null);
      setQrError('');
      return;
    }
    void loadQr(qrPass.id);
    return stopQrTimer;
  }, [qrPass, loadQr, stopQrTimer]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await get<DestinationOption[]>('/api/passes/history-destinations');
        if (!cancelled) setDestinations(result.data);
      } catch {
        // The destination filter degrades to "Todos": the history still loads.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    // Rapid filter or page changes can overlap. Keep only the newest response;
    // older ones would otherwise overwrite the table with a different page.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError('');

    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (destinationFilter !== 'all') params.set('destinationUnitId', destinationFilter);
    if (batchFilter) params.set('batchId', batchFilter.id);
    if (dateFrom) params.set('dateFrom', startOfLocalDay(dateFrom));
    if (dateTo) params.set('dateTo', endOfLocalDay(dateTo));
    params.set('sort', 'createdAt');
    params.set('order', order);

    try {
      const result = await get<ResidentPass[]>(`/api/passes?${params.toString()}`);
      if (requestId !== requestIdRef.current) return;
      setPasses(result.data);
      setTotal(result.total ?? result.data.length);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof ApiError && err.status === 404) {
        setDisabled(true);
      } else {
        setError('No se pudo cargar el historial.');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [
    page,
    pageSize,
    search,
    statusFilter,
    destinationFilter,
    dateFrom,
    dateTo,
    order,
    batchFilter,
    reloadKey,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  // The list stays at one query per page. The rule (with today's remaining
  // uses) is loaded only when a row is expanded, and re-fetched every time so
  // a scan that happened meanwhile is reflected.
  useEffect(() => {
    if (!passRow.expandedId) {
      setDetail(null);
      setDetailError('');
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    setDetailError('');

    void (async () => {
      try {
        const result = await get<PassDetail>(`/api/passes/${passRow.expandedId}`);
        if (!cancelled) setDetail(result.data);
      } catch {
        if (!cancelled) setDetailError('No se pudo cargar el detalle del pase.');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [passRow.expandedId]);

  // The guard scans in the app while this page is open, so the row has to move
  // to "Usada" without the resident touching anything.
  usePassStream({
    onEvent: () => {
      void load();
    },
  });

  async function copyLink(pass: ResidentPass) {
    if (!pass.shareUrl) return;
    try {
      await navigator.clipboard.writeText(pass.shareUrl);
      setNotice(`Enlace de ${visitorName(pass)} copiado.`);
    } catch {
      setNotice('El navegador no dejó copiar el enlace. Ábrelo desde el QR y cópialo a mano.');
    }
  }

  async function regenerateLink(pass: ResidentPass) {
    setBusyId(pass.id);
    setNotice('');
    try {
      const result = await post<{ shareUrl: string; linkExpiresAt: string }>(
        `/api/passes/${pass.id}/regenerate-link`,
      );
      setPasses((current) =>
        current.map((row) =>
          row.id === pass.id ? { ...row, shareUrl: result.data.shareUrl } : row,
        ),
      );
      try {
        await navigator.clipboard.writeText(result.data.shareUrl);
        setNotice(`Enlace nuevo de ${visitorName(pass)} copiado. El anterior dejó de funcionar.`);
      } catch {
        setNotice(`Enlace nuevo de ${visitorName(pass)} generado. El anterior dejó de funcionar.`);
      }
    } catch {
      setNotice('No se pudo regenerar el enlace. Prueba de nuevo en unos segundos.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRevoke() {
    if (!revokePass) return;
    setRevoking(true);
    setRevokeError('');
    try {
      await post(`/api/passes/${revokePass.id}/revoke`);
      setPasses((current) =>
        current.map((row) => (row.id === revokePass.id ? { ...row, status: 'revoked' } : row)),
      );
      setNotice(`Autorización de ${visitorName(revokePass)} revocada.`);
      setRevokePass(null);
    } catch {
      setRevokeError('No se pudo revocar la autorización. Prueba de nuevo.');
    } finally {
      setRevoking(false);
    }
  }

  function filterByBatch(pass: ResidentPass) {
    if (!pass.batchId) return;
    const label = pass.batchLabel ?? 'Carga masiva';
    setBatchFilter({ id: pass.batchId, label });
    setPage(1);
    setSearchParams({ batchId: pass.batchId, batchLabel: label }, { replace: true });
  }

  function clearBatchFilter() {
    setBatchFilter(null);
    setPage(1);
    if (searchParams.has('batchId') || searchParams.has('batchLabel')) {
      setSearchParams({}, { replace: true });
    }
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
    setDestinationFilter('all');
    setDateFrom('');
    setDateTo('');
    clearBatchFilter();
  }

  function toggleCreatedOrder() {
    setOrder((current) => (current === 'desc' ? 'asc' : 'desc'));
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    // A filter or layout change can leave the current page past the last one.
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-6">
      <PageHeader
        title="Autorizaciones"
        description="Todo lo que autorizaste, con su destino y su ventana de validez."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/resident/authorizations/bulk">
                <RiFileList3Line /> Carga masiva
              </Link>
            </Button>
            <Button asChild>
              <Link to="/resident/authorizations/new">
                <RiAddLine /> Autorizar visita
              </Link>
            </Button>
          </>
        }
      />

      {disabled && (
        <div className="panel p-6">
          <p className="text-sm font-medium">Las autorizaciones con QR están desactivadas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu administrador todavía no habilitó este módulo en la comunidad.
          </p>
        </div>
      )}

      {!disabled && (
        <>
          <ListToolbar
            search={searchInput}
            onSearchChange={setSearchInput}
            placeholder="Buscar autorizaciones"
          >
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44" aria-label="Estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="used">Usadas</SelectItem>
                <SelectItem value="revoked">Revocadas</SelectItem>
                <SelectItem value="expired">Vencidas</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={destinationFilter}
              onValueChange={(value) => {
                setDestinationFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-64" aria-label="Destino">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los destinos</SelectItem>
                {destinations.map((destination) => (
                  <SelectItem key={destination.id} value={destination.id}>
                    {destination.path || destination.name}
                    {destination.active ? '' : ' (archivado)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32" aria-label="Filas por página">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 filas</SelectItem>
                <SelectItem value="20">20 filas</SelectItem>
                <SelectItem value="50">50 filas</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              aria-label="Creado desde"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              className="w-40"
            />
            <Input
              type="date"
              aria-label="Creado hasta"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              className="w-40"
            />

            {(search ||
              statusFilter !== 'all' ||
              destinationFilter !== 'all' ||
              dateFrom ||
              dateTo ||
              batchFilter) && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </ListToolbar>

          {(batchFilter || total > 0) && !loading && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {total === 1 ? '1 autorización' : `${total} autorizaciones`}
                {totalPages > 1 ? ` · página ${page} de ${totalPages}` : ''}
              </span>
              {batchFilter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
                  Lote: {batchFilter.label}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Quitar filtro de lote"
                    onClick={clearBatchFilter}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}

          {notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          )}

          {error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadKey((value) => value + 1)}
              >
                Reintentar
              </Button>
            </div>
          )}

          {!error && loading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {!error && !loading && passes.length === 0 && (
            <div className="rounded-4xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">
                {search ||
                statusFilter !== 'all' ||
                destinationFilter !== 'all' ||
                dateFrom ||
                dateTo ||
                batchFilter
                  ? 'No hay autorizaciones con esos filtros'
                  : 'Todavía no hay autorizaciones'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ||
                statusFilter !== 'all' ||
                destinationFilter !== 'all' ||
                dateFrom ||
                dateTo ||
                batchFilter
                  ? 'Prueba limpiando los filtros.'
                  : 'Cuando autorices una visita, va a quedar registrada aquí.'}
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/resident/authorizations/new">Autorizar visita</Link>
              </Button>
            </div>
          )}

          {!error && !loading && passes.length > 0 && (
            <div className="min-h-0 flex-1 overflow-auto panel [&_td]:h-12">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitante</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead
                      aria-sort={order === 'asc' ? 'ascending' : 'descending'}
                      className="whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={toggleCreatedOrder}
                        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        aria-label="Ordenar por fecha de creación"
                      >
                        Creado
                        <span aria-hidden="true">{order === 'asc' ? '↑' : '↓'}</span>
                      </button>
                    </TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passes.map((pass) => {
                    const state = displayStatus(pass);
                    const name = visitorName(pass);
                    const isActive = state === 'active';
                    const isExpanded = passRow.isExpanded(pass.id);
                    const ruleLine = compactRule(pass);
                    const usesPerDay = pass.recurrence === 'range' || pass.recurrence === 'weekly';
                    return (
                      <Fragment key={pass.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40"
                          {...expandableRowProps(pass.id, isExpanded, passRow.toggle)}
                        >
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
                                {isExpanded ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{name}</span>
                                <span className="text-xs text-muted-foreground">
                                  Doc. {pass.visitorDocument}
                                </span>
                                {pass.companions && pass.companions.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {pass.companions.length}{' '}
                                    {pass.companions.length === 1 ? 'acompañante' : 'acompañantes'}
                                  </span>
                                )}
                                {pass.batchLabel && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      filterByBatch(pass);
                                    }}
                                    onKeyDown={(event) => event.stopPropagation()}
                                    className="mt-1 self-start text-xs text-primary underline underline-offset-2"
                                    aria-label={`Filtrar por el lote ${pass.batchLabel}`}
                                  >
                                    {pass.batchLabel}
                                  </button>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant={
                                  pass.destination?.kind === 'common_area' ? 'secondary' : 'outline'
                                }
                              >
                                {pass.destination?.kind === 'common_area'
                                  ? 'Zona común'
                                  : 'Vivienda'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {pass.locationPath || pass.destination?.path || 'Destino'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground">
                                {formatRange(pass.validFrom, pass.validUntil)}
                              </span>
                              {ruleLine && (
                                <span className="text-[11px] text-muted-foreground">
                                  {ruleLine}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {dateFormat.format(new Date(pass.createdAt))}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[state]}>{STATUS_LABELS[state]}</Badge>
                            {usesPerDay ? (
                              <Badge variant="secondary">
                                {pass.maxUses ?? 1}{' '}
                                {(pass.maxUses ?? 1) === 1 ? 'uso por día' : 'usos por día'}
                              </Badge>
                            ) : (pass.maxUses ?? 1) > 1 ? (
                              <Badge variant="secondary">
                                {Math.max(0, (pass.maxUses ?? 1) - (pass.exitCount ?? 0))} de{' '}
                                {pass.maxUses} usos
                              </Badge>
                            ) : null}
                            {pass.presenceState === 'inside' && state === 'active' ? (
                              <Badge variant="outline">Dentro</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                title="Ver QR"
                                aria-label={`Ver QR de ${name}`}
                                disabled={!isActive}
                                onClick={() => setQrPass(pass)}
                              >
                                <RiQrCodeLine />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                title="Copiar enlace"
                                aria-label={`Copiar enlace de ${name}`}
                                disabled={!pass.shareUrl}
                                onClick={() => void copyLink(pass)}
                              >
                                <RiFileCopyLine />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                title="Regenerar enlace"
                                aria-label={`Regenerar enlace de ${name}`}
                                disabled={!isActive || busyId === pass.id}
                                onClick={() => void regenerateLink(pass)}
                              >
                                {busyId === pass.id ? <RiPencilLine /> : <RiRefreshLine />}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                title="Revocar"
                                aria-label={`Revocar autorización de ${name}`}
                                disabled={!isActive}
                                onClick={() => {
                                  setRevokeError('');
                                  setRevokePass(pass);
                                }}
                              >
                                <RiForbidLine />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30">
                              {detailLoading ? (
                                <Skeleton className="h-20 w-full" />
                              ) : detailError ? (
                                <p role="alert" className="text-sm text-destructive">
                                  {detailError}
                                </p>
                              ) : detail ? (
                                <div className="space-y-3 py-2">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                      Regla del pase
                                    </p>
                                    <p className="mt-1 text-sm font-medium">
                                      {detail.rule?.summary ??
                                        ruleLine ??
                                        'Sin restricciones adicionales'}
                                    </p>
                                  </div>
                                  <DetailGrid>
                                    <DetailField
                                      label="Tipo"
                                      value={
                                        detail.type === 'entry_only'
                                          ? 'Sólo entrada'
                                          : 'Ingreso y salida'
                                      }
                                    />
                                    <DetailField label="Usos" value={detailUses(detail)} />
                                    <DetailField label="Documento" value={detail.visitorDocument} />
                                    <DetailField
                                      label="Presencia"
                                      value={
                                        detail.presenceState === 'inside'
                                          ? 'Dentro del conjunto'
                                          : 'Fuera del conjunto'
                                      }
                                    />
                                  </DetailGrid>
                                  {detail.companions && detail.companions.length > 0 && (
                                    <div>
                                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                        Acompañantes
                                      </p>
                                      <ul className="mt-1 space-y-1 text-sm">
                                        {detail.companions.map((companion, index) => (
                                          <li key={`${companion.document}-${index}`}>
                                            {companion.firstName} {companion.lastName}
                                            <span className="text-muted-foreground">
                                              {' '}
                                              · Doc. {companion.document}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!error && !loading && passes.length > 0 && (
            <div className="shrink-0">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                disabled={loading}
              />
            </div>
          )}
        </>
      )}

      <Dialog
        open={Boolean(qrPass)}
        onOpenChange={(open) => {
          if (!open) setQrPass(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR de acceso</DialogTitle>
            <DialogDescription>
              {qrPass ? visitorName(qrPass) : ''} ·{' '}
              {qrPass?.locationPath || qrPass?.destination?.path || 'Destino'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            {qr ? (
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={qr.token} size={216} level="M" />
              </div>
            ) : (
              <Skeleton className="size-56 rounded-xl" />
            )}
            <p className="text-center text-xs text-muted-foreground">
              {qrLoading && !qr
                ? 'Generando el QR…'
                : 'El código se renueva solo. No lo compartas fuera de la visita.'}
            </p>
            {qrError && (
              <p role="alert" className="text-sm text-destructive">
                {qrError}
              </p>
            )}
            {qrPass?.shareUrl && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void copyLink(qrPass)}
              >
                <RiFileCopyLine /> Copiar enlace
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(revokePass)}
        onOpenChange={(open) => {
          if (!open) setRevokePass(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revocar autorización</DialogTitle>
            <DialogDescription>
              El QR y el enlace de {revokePass ? visitorName(revokePass) : 'esta visita'} van a
              dejar de funcionar. La visita ya no va a poder ingresar con esta autorización.
            </DialogDescription>
          </DialogHeader>

          {revokeError && (
            <p role="alert" className="text-sm text-destructive">
              {revokeError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevokePass(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={revoking}
              onClick={() => void confirmRevoke()}
            >
              {revoking ? 'Revocando…' : 'Revocar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
