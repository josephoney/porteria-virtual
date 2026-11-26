import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { patch } from '../lib/apiClient';
import { fieldA11y } from '../lib/form';

const MIN_PASSWORD = 8;

/**
 * Cambio obligatorio tras un reseteo del administrador.
 *
 * Se muestra antes que cualquier otra pantalla: mientras la contraseña temporal
 * esté activa, la API responde 403 `password_change_required` en todo lo demás.
 */
export function ChangePasswordPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD;
  const mismatch = repeat.length > 0 && next !== repeat;
  const canSubmit = next.length >= MIN_PASSWORD && next === repeat;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      // No se envía la contraseña actual: el ingreso ya probó la identidad y la
      // temporal la conoce quien la entregó.
      await patch('/api/me/password', { newPassword: next });
      // El cambio revoca las sesiones: hay que volver a entrar con la nueva.
      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo cambiar la contraseña. Intenta de nuevo.',
      );
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Define tu contraseña</CardTitle>
          <CardDescription>
            La contraseña actual es temporal. Elige una propia para seguir usando la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-1">
              <Label htmlFor="new-password">Contraseña nueva</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                required
                aria-invalid={tooShort}
                aria-describedby={
                  tooShort ? 'new-password-error new-password-hint' : 'new-password-hint'
                }
              />
              <p id="new-password-hint" className="text-xs text-muted-foreground">
                Mínimo ocho caracteres.
              </p>
              {tooShort && (
                <p id="new-password-error" role="alert" className="text-xs text-destructive">
                  Debe tener al menos ocho caracteres.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="repeat-password">Repite la contraseña nueva</Label>
              <Input
                id="repeat-password"
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
                required
                {...fieldA11y('repeat-password', mismatch ? 'mismatch' : undefined)}
              />
              {mismatch && (
                <p id="repeat-password-error" role="alert" className="text-xs text-destructive">
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
              {saving ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
