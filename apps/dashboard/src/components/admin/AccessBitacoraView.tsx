import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError, get, post } from '../../lib/apiClient';
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
  shiftId: string | null;
  type: string;
  source: string;
  authorName: string | null;
  passId: string | null;
  passScanId: string | null;
  summary: string;
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

interface AccessBitacoraViewProps {
  communityId?: string | null;
  accessPointId?: string | null;
  compact?: boolean;
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

  const pageSize = 20;

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
    if (type !== 'all') params.set('type', type);
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
  }, [communityId, accessPointId, type, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
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
              {Object.entries(typeLabels).map(([value, label]) => (
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
        <div className="rounded-4xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Acceso</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Detalle</TableHead>
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
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">{entry.summary}</TableCell>
                  <TableCell>{entry.authorName ?? 'Sistema'}</TableCell>
                  <TableCell>{entry.commentCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {page} de {totalPages} · {total} movimientos
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del movimiento</DialogTitle>
            <DialogDescription>
              La entrada original no se puede editar. Podés agregar un comentario.
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
