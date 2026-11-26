import { useEffect, useState } from 'react';
import { RiCloseLine, RiFileCopyLine } from '@remixicon/react';
import { ApiError, post } from '../../lib/apiClient';
import { emailError as validateInviteEmail, fieldA11y, hasErrors } from '../../lib/form';
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
import { NativeSelect } from '../ui/native-select';

export interface InvitableUnit {
  id: string;
  code: string | null;
  name: string;
  communityId: string;
}

interface ResidentInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: InvitableUnit[];
  onCreated?: () => void;
}

interface InvitationResponse {
  invitation: { id: string; email: string; role: string };
  acceptUrl: string;
  emailSent: boolean;
}

const ROLE_OPTIONS = [
  { value: 'resident', label: 'Residente' },
  { value: 'tenant', label: 'Arrendatario' },
  { value: 'owner', label: 'Propietario' },
];

const ERROR_MESSAGES: Record<string, string> = {
  already_member: 'Esa persona ya tiene una cuenta activa en una de las unidades seleccionadas.',
  unit_invalid: 'Una de las unidades seleccionadas no es válida para invitar residentes.',
  too_many_units: 'La invitación supera el máximo de unidades permitido.',
  forbidden: 'No tienes permiso para invitar en una de las unidades seleccionadas.',
};

export function ResidentInviteDialog({
  open,
  onOpenChange,
  units,
  onCreated,
}: ResidentInviteDialogProps) {
  const [selectedUnits, setSelectedUnits] = useState<InvitableUnit[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('resident');
  const [emailError, setEmailError] = useState('');
  const [unitsError, setUnitsError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<InvitationResponse | null>(null);
  const [sentUnitCount, setSentUnitCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelectedUnits(units);
  }, [units]);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setRole('resident');
      setEmailError('');
      setUnitsError('');
      setError('');
      setResult(null);
      setSentUnitCount(0);
      setCopied(false);
    }
  }, [open]);

  function removeUnit(unitId: string) {
    setSelectedUnits((current) => current.filter((unit) => unit.id !== unitId));
    setUnitsError('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const currentUnits = selectedUnits;
    const validation = validateInviteEmail(email);
    const nextUnitsError =
      currentUnits.length === 0 ? 'Selecciona al menos una unidad.' : '';
    setEmailError(validation);
    setUnitsError(nextUnitsError);
    if (hasErrors({ email: validation, units: nextUnitsError }) || currentUnits.length === 0) {
      return;
    }

    const communityId = currentUnits[0]?.communityId;
    if (!communityId || currentUnits.some((unit) => unit.communityId !== communityId)) {
      setUnitsError('Todas las unidades deben pertenecer a la misma comunidad.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { data } = await post<InvitationResponse>('/api/invitations', {
        email: email.trim(),
        role,
        communityId,
        locationUnitIds: currentUnits.map((unit) => unit.id),
      });
      setResult(data);
      setSentUnitCount(currentUnits.length);
      onCreated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body;
        const code =
          typeof body === 'object' && body !== null && 'message' in body
            ? String((body as { message?: unknown }).message ?? '')
            : '';
        const conflictUnitId =
          typeof body === 'object' && body !== null && 'unitId' in body
            ? String((body as { unitId?: unknown }).unitId ?? '')
            : '';
        const conflictUnit = currentUnits.find((unit) => unit.id === conflictUnitId);
        if ((code === 'conflict' || code === 'already_member') && conflictUnit) {
          setError(
            `La persona ya tiene una membresía en ${
              conflictUnit.code ?? conflictUnit.name
            }. Quita esa unidad para continuar.`,
          );
        } else {
          setError(ERROR_MESSAGES[code] ?? err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo crear la invitación.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.acceptUrl);
    setCopied(true);
  }

  const unitCount = selectedUnits.length;
  const unitLabel = unitCount === 1 ? 'la unidad seleccionada' : 'las unidades seleccionadas';
  const submittedUnitLabel = sentUnitCount === 1 ? '1 unidad' : `${sentUnitCount} unidades`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar residente</DialogTitle>
          <DialogDescription>
            Se enviará un correo con un enlace para crear la cuenta y quedar asociado a {unitLabel}.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                {result.emailSent
                  ? `Invitación enviada a ${result.invitation.email} para ${submittedUnitLabel}.`
                  : `La invitación quedó creada, pero el correo no se pudo enviar. Comparte este enlace con ${result.invitation.email}.`}
              </AlertDescription>
            </Alert>
            <div className="flex items-start gap-2 rounded-3xl border border-border bg-muted/30 p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-xs">{result.acceptUrl}</code>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
                <RiFileCopyLine className="size-4" aria-hidden="true" />
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="resident-invite-email">Correo</Label>
              <Input
                id="resident-invite-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError('');
                }}
                {...fieldA11y('resident-invite-email', emailError)}
              />
              {emailError && (
                <p id="resident-invite-email-error" role="alert" className="text-xs text-destructive">
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="resident-invite-role">Rol</Label>
              <NativeSelect
                id="resident-invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Unidades</Label>
                <span className="text-xs text-muted-foreground">
                  {unitCount} de 50
                </span>
              </div>
              {unitCount === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  No hay unidades seleccionadas.
                </p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {selectedUnits.map((unit) => (
                    <li
                      key={unit.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="font-mono text-xs text-muted-foreground">
                          {unit.code ?? 'Sin código'}
                        </span>{' '}
                        <span className="truncate">{unit.name}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Quitar ${unit.name}`}
                        title={`Quitar ${unit.name}`}
                        onClick={() => removeUnit(unit.id)}
                      >
                        <RiCloseLine />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {unitsError && (
                <p id="resident-invite-units-error" role="alert" className="text-xs text-destructive">
                  {unitsError}
                </p>
              )}
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
              <Button type="submit" disabled={saving || unitCount === 0} aria-busy={saving}>
                {saving ? 'Enviando…' : 'Enviar invitación'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
