import { useState } from 'react';
import { Link } from 'react-router-dom';

import { AuthShell } from '../components/auth/AuthShell';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { post } from '../lib/apiClient';

/**
 * Pide el enlace de recuperación.
 *
 * La respuesta es la misma exista o no la cuenta, y la pantalla lo dice tal cual:
 * si dijera «ese correo no existe», el formulario serviría para averiguar quién
 * tiene cuenta.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      await post('/api/auth/password/forgot', { email: email.trim() });
      setSent(true);
    } catch {
      setError('No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell>
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Recuperar contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Escribe el correo de tu cuenta y te enviamos un enlace para definir una contraseña
            nueva.
          </p>
        </div>

        {sent ? (
          <div className="space-y-3">
            <p className="text-sm">
              Si existe una cuenta con <span className="font-medium">{email}</span>, el enlace ya
              salió. Revisa tu correo; el enlace vence en 60 minutos y sólo sirve una vez.
            </p>
            <Link className="text-sm underline underline-offset-4" to="/login">
              Volver al ingreso
            </Link>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-1">
              <Label htmlFor="forgot-email">Correo</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={sending || !email.trim()}>
              {sending ? 'Enviando…' : 'Enviar enlace'}
            </Button>
            <Link className="block text-center text-sm underline underline-offset-4" to="/login">
              Volver al ingreso
            </Link>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
