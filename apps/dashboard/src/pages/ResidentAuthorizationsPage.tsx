import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  RiAddLine,
  RiFileCopyLine,
  RiFileList3Line,
  RiForbidLine,
  RiPencilLine,
  RiQrCodeLine,
  RiRefreshLine,
} from '@remixicon/react';
import { QRCodeSVG } from 'qrcode.react';
import type { DestinationOption } from '@porteria/shared';
import { ApiError, get, post } from '../lib/apiClient';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
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

const PAGE_SIZE = 10;

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
  validFrom: string;
  validUntil: string;
  status: string;
  batchId: string | null;
  batchLabel: string | null;
  shareUrl: string | null;
  destination?: PassDestination;
  locationPath?: string;
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
  return `${dateFormat.format(new Date(from))} → ${dateFormat.format(new Date(until))}`;
}

export function ResidentAuthorizationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [passes, setPasses] = useState<ResidentPass[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');
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
        setQrError('No pudimos generar el QR. Cerrá el diálogo y revisá el estado del pase.');
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
    setLoading(true);
    setError('');

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (destinationFilter !== 'all') params.set('destinationUnitId', destinationFilter);
    if (batchFilter) params.set('batchId', batchFilter.id);

    try {
      const result = await get<ResidentPass[]>(`/api/passes?${params.toString()}`);
      setPasses(result.data);
      setTotal(result.total ?? result.data.length);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabled(true);
      } else {
        setError('No se pudo cargar el historial.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, destinationFilter, batchFilter, reloadKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyLink(pass: ResidentPass) {
    if (!pass.shareUrl) return;
    try {
      await navigator.clipboard.writeText(pass.shareUrl);
      setNotice(`Enlace de ${visitorName(pass)} copiado.`);
    } catch {
      setNotice('El navegador no dejó copiar el enlace. Abrilo desde el QR y copialo a mano.');
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
      setNotice('No se pudo regenerar el enlace. Probá de nuevo en unos segundos.');
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
      setRevokeError('No se pudo revocar la autorización. Probá de nuevo.');
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
    clearBatchFilter();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 space-y-6">
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
        <div className="rounded-4xl border border-border bg-card p-6">
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

            {(search || statusFilter !== 'all' || destinationFilter !== 'all' || batchFilter) && (
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
                {search || statusFilter !== 'all' || destinationFilter !== 'all' || batchFilter
                  ? 'No hay autorizaciones con esos filtros'
                  : 'Todavía no hay autorizaciones'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search || statusFilter !== 'all' || destinationFilter !== 'all' || batchFilter
                  ? 'Probá limpiando los filtros.'
                  : 'Cuando autorices una visita, va a quedar registrada acá.'}
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/resident/authorizations/new">Autorizar visita</Link>
              </Button>
            </div>
          )}

          {!error && !loading && passes.length > 0 && (
            <div className="overflow-hidden rounded-4xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitante</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passes.map((pass) => {
                    const state = displayStatus(pass);
                    const name = visitorName(pass);
                    const isActive = state === 'active';
                    return (
                      <TableRow key={pass.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{name}</span>
                            <span className="text-xs text-muted-foreground">
                              Doc. {pass.visitorDocument}
                            </span>
                            {pass.batchLabel && (
                              <button
                                type="button"
                                onClick={() => filterByBatch(pass)}
                                className="mt-1 self-start text-xs text-primary underline underline-offset-2"
                                aria-label={`Filtrar por el lote ${pass.batchLabel}`}
                              >
                                {pass.batchLabel}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={
                                pass.destination?.kind === 'common_area' ? 'secondary' : 'outline'
                              }
                            >
                              {pass.destination?.kind === 'common_area' ? 'Zona común' : 'Vivienda'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {pass.locationPath || pass.destination?.path || 'Destino'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatRange(pass.validFrom, pass.validUntil)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[state]}>{STATUS_LABELS[state]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!error && !loading && passes.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              disabled={loading}
            />
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
