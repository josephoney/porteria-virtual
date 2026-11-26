import { useEffect, useState } from 'react';
import { RiFileCopyLine } from '@remixicon/react';
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

interface InvitableUnit {
  id: string;
  code: string | null;
  name: string;
  communityId: string;
}

interface ResidentInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: InvitableUnit | null;
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
  already_member: 'Esa persona ya tiene una cuenta activa en esta unidad.',
  unit_invalid: 'La unidad seleccionada no es válida para invitar residentes.',
  too_many_units: 'La invitación supera el máximo de unidades permitido.',
  forbidden: 'No tienes permiso para invitar en esta unidad.',
};

export function ResidentInviteDialog({
  open,
  onOpenChange,
  unit,
  onCreated,
}: ResidentInviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('resident');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<InvitationResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setRole('resident');
      setEmailError('');
      setError('');
      setResult(null);
      setCopied(false);
    }
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!unit) return;

    const validation = validateInviteEmail(email);
    setEmailError(validation);
    if (hasErrors({ email: validation })) return;

    setSaving(true);
    setError('');
    try {
      const { data } = await post<InvitationResponse>('/api/invitations', {
        email: email.trim(),
        role,
        communityId: unit.communityId,
        locationUnitIds: [unit.id],
      });
      setResult(data);
      onCreated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body;
        const code =
          typeof body === 'object' && body !== null && 'message' in body
            ? String((body as { message?: unknown }).message ?? '')
            : '';
        setError(ERROR_MESSAGES[code] ?? err.message);
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

  const unitLabel = unit ? `${unit.code ?? unit.name} · ${unit.name}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar residente</DialogTitle>
          <DialogDescription>
            Se enviará un correo con un enlace para crear la cuenta y quedar asociado a{' '}
            <span className="font-medium text-foreground">{unitLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                {result.emailSent
                  ? `Invitación enviada a ${result.invitation.email}.`
                  : `La cuenta quedó creada, pero el correo no se pudo enviar. Comparte este enlace con ${result.invitation.email}.`}
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

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} aria-busy={saving}>
                {saving ? 'Enviando…' : 'Enviar invitación'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
