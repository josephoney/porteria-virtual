import { useEffect, useState } from 'react';
import { ApiError, patch } from '../../lib/apiClient';
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
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface EditableUnit {
  id: string;
  name: string;
  code: string | null;
  path?: string | null;
}

interface EditUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: EditableUnit | null;
  onSaved: () => void;
}

const DUPLICATE_MESSAGES: Record<string, string> = {
  duplicate_name: 'Ya existe una unidad con ese nombre en esa sección.',
  duplicate_code: 'Ya existe una unidad con ese código en esa sección.',
};

export function EditUnitDialog({ open, onOpenChange, unit, onSaved }: EditUnitDialogProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !unit) return;
    setName(unit.name);
    setCode(unit.code ?? '');
    setError(null);
    setFieldError(null);
  }, [open, unit]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!unit) return;
    if (!name.trim()) {
      setFieldError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    setFieldError(null);
    try {
      await patch(`/api/location-units/${unit.id}`, {
        name: name.trim(),
        code: code.trim() || null,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const code = err instanceof ApiError ? (err.body as { code?: string } | null)?.code : undefined;
      setError(
        DUPLICATE_MESSAGES[code ?? ''] ??
          (err instanceof Error ? err.message : 'No se pudo guardar la unidad.'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar unidad</DialogTitle>
          <DialogDescription>
            {unit?.path ? `Ubicación: ${unit.path}` : 'Cambia el nombre o el código de la unidad.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label htmlFor="edit-unit-name">Nombre</Label>
            <Input
              id="edit-unit-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFieldError(null);
              }}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? 'edit-unit-name-error' : undefined}
            />
            {fieldError && (
              <p id="edit-unit-name-error" role="alert" className="text-xs text-destructive">
                {fieldError}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-unit-code">Código (opcional)</Label>
            <Input
              id="edit-unit-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
