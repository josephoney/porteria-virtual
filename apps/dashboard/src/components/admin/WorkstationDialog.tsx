import { useCallback, useEffect, useState } from 'react';
import { ApiError, get, put } from '../../lib/apiClient';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';

export interface WorkstationTarget {
  membershipId: string;
  communityId: string | null;
  communityName?: string | null;
  accessPointId: string | null;
}

interface AccessPointOption {
  id: string;
  name: string;
  type: string;
  direction: string;
  active: boolean;
}

interface WorkstationResponse {
  accessPointId: string | null;
  appliesNextShift?: boolean;
  activeShiftAccessPointId?: string | null;
}

interface WorkstationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  target: WorkstationTarget | null;
  onSaved: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  role_not_guard: 'Solo las membresías de guardia pueden tener un puesto de trabajo.',
  membership_requires_community: 'La membresía no tiene comunidad: asígnale una primero.',
  access_point_inactive: 'Ese acceso está inactivo. Elige uno activo.',
  tenant_read_only: 'El administrador de plataforma no puede editar datos del conjunto.',
  forbidden: 'No tienes permiso para asignar puestos en esta comunidad.',
  not_found: 'La membresía o el acceso ya no existen.',
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const code = (error as ApiError & { code?: string }).code;
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
    if (ERROR_MESSAGES[error.message]) return ERROR_MESSAGES[error.message];
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'No se pudo guardar el puesto.';
}

export function WorkstationDialog({
  open,
  onOpenChange,
  userEmail,
  target,
  onSaved,
}: WorkstationDialogProps) {
  const [accessPoints, setAccessPoints] = useState<AccessPointOption[]>([]);
  const [selected, setSelected] = useState('none');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shiftAccessPointName, setShiftAccessPointName] = useState<string | null>(null);

  const loadAccessPoints = useCallback(async (communityId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await get<{ items: AccessPointOption[] }>(
        `/api/communities/${communityId}/access-points`,
      );
      setAccessPoints(data.items.filter((item) => item.active));
    } catch (err) {
      setError(errorMessage(err));
      setAccessPoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !target) return;
    setSelected(target.accessPointId ?? 'none');
    setError(null);
    setNotice(null);
    setShiftAccessPointName(null);
    if (target.communityId) {
      void loadAccessPoints(target.communityId);
    } else {
      setAccessPoints([]);
    }
  }, [open, target, loadAccessPoints]);

  async function handleSave() {
    if (!target) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await put<WorkstationResponse>(
        `/api/memberships/${target.membershipId}/workstation`,
        { accessPointId: selected === 'none' ? null : selected },
      );

      if (data.appliesNextShift) {
        const current = accessPoints.find((item) => item.id === data.activeShiftAccessPointId);
        setShiftAccessPointName(current?.name ?? null);
        setNotice(
          'El cambio se aplica desde el próximo turno. El turno abierto conserva su acceso.',
        );
      } else {
        setNotice('Puesto actualizado.');
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const noCommunity = Boolean(target && !target.communityId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Puesto por defecto</DialogTitle>
          <DialogDescription>
            Define en qué acceso inicia turno {userEmail}. Es un valor por defecto: el guardia
            puede cubrir otro acceso activo de su comunidad.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Comunidad:{' '}
            <span className="font-medium text-foreground">
              {target?.communityName ?? 'sin comunidad'}
            </span>
          </p>

          {loading ? (
            <Skeleton className="h-9 w-full" />
          ) : noCommunity ? (
            <Alert variant="destructive">
              <AlertDescription>
                Esta membresía no tiene comunidad. Asígnale una comunidad antes de definir un
                puesto.
              </AlertDescription>
            </Alert>
          ) : accessPoints.length === 0 ? (
            <Alert>
              <AlertDescription>
                La comunidad no tiene accesos activos.{' '}
                <a className="underline" href="/admin/access-points">
                  Crea un acceso
                </a>{' '}
                antes de asignar puestos.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="workstation-access-point">Puesto por defecto</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="workstation-access-point" className="w-full">
                  <SelectValue placeholder="Elige un acceso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {accessPoints.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {shiftAccessPointName && (
            <p className="text-xs text-muted-foreground">
              Turno abierto en: {shiftAccessPointName}.
            </p>
          )}

          {notice && (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {notice ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || noCommunity || accessPoints.length === 0}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
