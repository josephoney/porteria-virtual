import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError, del, get, patch, post } from '../../lib/apiClient';
import { fieldA11y, hasErrors, requiredError } from '../../lib/form';
import { PageHeader } from '../layout/PageHeader';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/confirm-dialog';
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
import { AccessPointGuardsDialog } from './AccessPointGuardsDialog';

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
  gpioPin: number | null;
  failPolicy: string;
  active: boolean;
  /** Guardias con este acceso como puesto por defecto. */
  assignedGuards?: number;
  createdAt: string;
  updatedAt: string;
}

interface AccessPointForm {
  name: string;
  type: 'door' | 'gate' | 'turnstile';
  direction: 'entry' | 'exit' | 'both';
  gpioPin: string;
  failPolicy: 'open' | 'closed';
}

const emptyForm: AccessPointForm = {
  name: '',
  type: 'gate',
  direction: 'both',
  gpioPin: '',
  failPolicy: 'closed',
};

const typeLabels: Record<string, string> = {
  door: 'Puerta',
  gate: 'Portón',
  turnstile: 'Torniquete',
};

const directionLabels: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Salida',
  both: 'Ambos',
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}

export function AccessPointsPanel() {
  const { activeMembership } = useAuth();
  const isOrgAdmin = activeMembership?.role === 'org_admin';
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [communityId, setCommunityId] = useState<string | null>(
    activeMembership?.communityId ?? null,
  );
  const [items, setItems] = useState<AccessPointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccessPointRow | null>(null);
  const [form, setForm] = useState<AccessPointForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; gpioPin?: string }>({});
  const [guardsTarget, setGuardsTarget] = useState<AccessPointRow | null>(null);

  useEffect(() => {
    setCommunityId(activeMembership?.communityId ?? null);
  }, [activeMembership?.communityId]);

  useEffect(() => {
    if (!isOrgAdmin) return;
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
  }, [isOrgAdmin]);

  const load = useCallback(async () => {
    if (!communityId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await get<{ items: AccessPointRow[] }>(
        `/api/communities/${communityId}/access-points?includeInactive=true`,
      );
      setItems(result.data.items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = useMemo(() => items.filter((item) => item.active).length, [items]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setDialogOpen(true);
  }

  function openEdit(item: AccessPointRow) {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type as AccessPointForm['type'],
      direction: item.direction as AccessPointForm['direction'],
      gpioPin: item.gpioPin === null ? '' : String(item.gpioPin),
      failPolicy: item.failPolicy as AccessPointForm['failPolicy'],
    });
    setFieldErrors({});
    setDialogOpen(true);
  }

  async function save() {
    if (!communityId) return;

    const gpioValue = form.gpioPin.trim();
    const validation = {
      name: requiredError(form.name, 'El nombre'),
      gpioPin:
        gpioValue !== '' && !/^\d+$/.test(gpioValue)
          ? 'El GPIO debe ser un número entero mayor o igual a 0.'
          : '',
    };
    setFieldErrors(validation);
    if (hasErrors(validation)) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        direction: form.direction,
        gpioPin: form.gpioPin.trim() === '' ? null : Number(form.gpioPin),
        failPolicy: form.failPolicy,
      };
      if (editing) {
        await patch(`/api/communities/${communityId}/access-points/${editing.id}`, payload);
      } else {
        await post(`/api/communities/${communityId}/access-points`, payload);
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /** Acción destructiva pendiente de confirmación. */
  const [confirmTarget, setConfirmTarget] = useState<AccessPointRow | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  async function deactivate(item: AccessPointRow) {
    if (!communityId) return;
    setConfirmTarget(item);
  }

  async function confirmDeactivate() {
    const item = confirmTarget;
    if (!communityId || !item) return;
    setConfirmPending(true);
    setError(null);
    try {
      await del(`/api/communities/${communityId}/access-points/${item.id}`);
      await load();
      setConfirmTarget(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setConfirmPending(false);
    }
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title="Desactivar acceso"
        description={`El acceso "${confirmTarget?.name ?? ''}" dejará de aceptar registros. La bitácora ya escrita se conserva.`}
        confirmLabel="Desactivar"
        destructive
        pending={confirmPending}
        onConfirm={() => void confirmDeactivate()}
      />
      <PageHeader
        title="Accesos"
        description="Porterías y portones de la comunidad. Cada lugar físico tiene su propia bitácora."
        actions={
          <Button type="button" onClick={openCreate} disabled={!communityId}>
            Nuevo acceso
          </Button>
        }
      />

      {isOrgAdmin && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Comunidad</Label>
            <Select value={communityId ?? ''} onValueChange={(value) => setCommunityId(value)}>
              <SelectTrigger className="w-64">
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
          <p className="pb-2 text-sm text-muted-foreground">
            {activeCount} activos de {items.length}
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          Todavía no hay accesos. Crea el primero para poder iniciar turnos.
        </div>
      ) : (
        <div className="panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>GPIO</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Guardias</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{typeLabels[item.type] ?? item.type}</TableCell>
                  <TableCell>{directionLabels[item.direction] ?? item.direction}</TableCell>
                  <TableCell>{item.gpioPin ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={item.active ? 'default' : 'secondary'}>
                      {item.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm tabular-nums">{item.assignedGuards ?? 0}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Ver guardias de ${item.name}`}
                        onClick={() => setGuardsTarget(item)}
                      >
                        Ver
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                        Editar
                      </Button>
                      {item.active && (
                        <Button variant="destructive" size="sm" onClick={() => deactivate(item)}>
                          Desactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AccessPointGuardsDialog
        open={Boolean(guardsTarget)}
        onOpenChange={(open) => {
          if (!open) setGuardsTarget(null);
        }}
        communityId={communityId}
        accessPointId={guardsTarget?.id ?? null}
        accessPointName={guardsTarget?.name ?? ''}
        onChanged={() => void load()}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar acceso' : 'Nuevo acceso'}</DialogTitle>
            <DialogDescription>
              El nombre identifica la portería o portón en la bitácora y en la app del guardia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="access-point-name">Nombre</Label>
              <Input
                id="access-point-name"
                value={form.name}
                onChange={(event) => {
                  setForm((current) => ({ ...current, name: event.target.value }));
                  setFieldErrors((current) => ({ ...current, name: undefined }));
                }}
                placeholder="Portón Principal"
                {...fieldA11y('access-point-name', fieldErrors.name)}
              />
              {fieldErrors.name && (
                <p id="access-point-name-error" role="alert" className="text-xs text-destructive">
                  {fieldErrors.name}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      type: value as AccessPointForm['type'],
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gate">Portón</SelectItem>
                    <SelectItem value="door">Puerta</SelectItem>
                    <SelectItem value="turnstile">Torniquete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Dirección</Label>
                <Select
                  value={form.direction}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      direction: value as AccessPointForm['direction'],
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Ambos</SelectItem>
                    <SelectItem value="entry">Entrada</SelectItem>
                    <SelectItem value="exit">Salida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="access-point-gpio">GPIO (opcional)</Label>
                <Input
                  id="access-point-gpio"
                  inputMode="numeric"
                  value={form.gpioPin}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, gpioPin: event.target.value }));
                    setFieldErrors((current) => ({ ...current, gpioPin: undefined }));
                  }}
                  placeholder="17"
                  {...fieldA11y('access-point-gpio', fieldErrors.gpioPin)}
                />
                {fieldErrors.gpioPin && (
                  <p id="access-point-gpio-error" role="alert" className="text-xs text-destructive">
                    {fieldErrors.gpioPin}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Falla</Label>
                <Select
                  value={form.failPolicy}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      failPolicy: value as AccessPointForm['failPolicy'],
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closed">Cerrado</SelectItem>
                    <SelectItem value="open">Abierto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
