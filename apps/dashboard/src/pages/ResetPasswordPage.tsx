import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AuthShell } from '../components/auth/AuthShell';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { post } from '../lib/apiClient';
import { fieldA11y } from '../lib/form';

const MIN_PASSWORD = 8;

/** Define la contraseña nueva a partir del token que llegó por correo. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = repeat.length > 0 && password !== repeat;
  const canSubmit = Boolean(token) && password.length >= MIN_PASSWORD && password === repeat;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await post('/api/auth/password/reset', { token, password });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'El enlace no es válido o ya se usó. Pide uno nuevo.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell>
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Nueva contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Al guardar, se cierran todas las sesiones abiertas de tu cuenta.
          </p>
        </div>

        {!token ? (
          <p className="text-sm text-destructive">
            Falta el enlace. Ábrelo desde el correo o{' '}
            <Link className="underline underline-offset-4" to="/forgot-password">
              pide uno nuevo
            </Link>
            .
          </p>
        ) : done ? (
          <div className="space-y-3">
            <p className="text-sm">
              La contraseña quedó guardada. Ya puedes ingresar con la nueva.
            </p>
            <Link className="text-sm underline underline-offset-4" to="/login">
              Ir al ingreso
            </Link>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-1">
              <Label htmlFor="reset-password">Contraseña</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                aria-invalid={tooShort}
                aria-describedby={
                  tooShort ? 'reset-password-error reset-password-hint' : 'reset-password-hint'
                }
              />
              <p id="reset-password-hint" className="text-xs text-muted-foreground">
                Mínimo ocho caracteres.
              </p>
              {tooShort && (
                <p id="reset-password-error" role="alert" className="text-xs text-destructive">
                  Debe tener al menos ocho caracteres.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="reset-repeat">Repite la contraseña</Label>
              <Input
                id="reset-repeat"
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
                required
                {...fieldA11y('reset-repeat', mismatch ? 'mismatch' : undefined)}
              />
              {mismatch && (
                <p id="reset-repeat-error" role="alert" className="text-xs text-destructive">
                  No coinciden.
                </p>
              )}
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={saving || !canSubmit}>
              {saving ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
