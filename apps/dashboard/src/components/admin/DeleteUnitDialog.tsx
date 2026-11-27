import { useEffect, useState } from 'react';
import { ApiError, del } from '../../lib/apiClient';
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

export interface DeletableUnit {
  id: string;
  name: string;
  path?: string | null;
}

interface DeleteUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: DeletableUnit | null;
  onDeleted: () => void;
}

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'No se pudo eliminar la unidad.';
  }
  const code = (error.body as { code?: string } | null)?.code;
  if (code === 'node_has_authorizations') {
    return 'Esta unidad ya tiene autorizaciones registradas. Archívala en lugar de eliminarla.';
  }
  if (error.message === 'Cannot delete a node with children') {
    return 'Esta unidad tiene elementos dentro. Elimínalos o archívalos primero.';
  }
  if (error.message === 'Cannot delete a node with residents') {
    return 'Esta unidad tiene residentes asociados. Quítalos o archívala en lugar de eliminarla.';
  }
  if (error.status === 404) return 'La unidad ya no existe.';
  return error.message;
}

/**
 * Borrado con dos confirmaciones: el primer paso explica el alcance y el segundo
 * exige confirmar de nuevo, porque la acción no se puede deshacer.
 */
export function DeleteUnitDialog({
  open,
  onOpenChange,
  unit,
  onDeleted,
}: DeleteUnitDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
  }, [open]);

  async function confirmDelete() {
    if (!unit) return;
    setSaving(true);
    setError(null);
    try {
      await del(`/api/location-units/${unit.id}`);
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Eliminar unidad' : 'Confirmar eliminación'}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Esta acción quita la unidad del listado y de la estructura. No se puede deshacer.'
              : 'Última confirmación: la unidad se elimina de forma definitiva.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Unidad: </span>
            <span className="font-medium">{unit?.name}</span>
          </p>
          {unit?.path && (
            <p className="text-muted-foreground">Ubicación: {unit.path}</p>
          )}
          {step === 2 && (
            <p className="text-destructive">
              Si la unidad tiene residentes o autorizaciones, el sistema lo rechazará: en ese
              caso archívala en lugar de eliminarla.
            </p>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {step === 1 ? (
            <Button type="button" variant="destructive" onClick={() => setStep(2)}>
              Continuar
            </Button>
          ) : (
            <Button type="button" variant="destructive" disabled={saving} onClick={confirmDelete}>
              {saving ? 'Eliminando…' : 'Eliminar definitivamente'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
