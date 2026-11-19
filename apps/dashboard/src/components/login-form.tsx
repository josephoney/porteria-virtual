import { useState } from 'react';
import { useAuth, type ActiveMembership } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { RiErrorWarningLine, RiLoader4Line } from '@remixicon/react';

interface SelectionState {
  memberships: ActiveMembership[];
  selectionToken: string;
}

type AuthMode = 'login' | 'signup';

function extractInviteToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/invite\/([^/?#]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return trimmed;
}

export function LoginForm({
  className,
  communitySlug,
  ...props
}: React.ComponentProps<'div'> & { communitySlug?: string }) {
  const { login, selectContext } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password, communitySlug);
      if (result.requiresContextSelection && result.selectionToken) {
        setSelection({
          memberships: result.memberships ?? [],
          selectionToken: result.selectionToken,
        });
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email o contraseña inválidos');
    } finally {
      setLoading(false);
    }
  }

  function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const token = extractInviteToken(inviteToken);
    if (!token) {
      setError('Pide una invitación al administrador de tu comunidad.');
      return;
    }
    navigate(`/invite/${encodeURIComponent(token)}`);
  }

  async function handleSelect(membershipId: string) {
    if (!selection) return;
    setError('');
    setLoading(true);
    try {
      await selectContext(membershipId, selection.selectionToken);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo seleccionar el contexto');
    } finally {
      setLoading(false);
    }
  }

  if (selection) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Elige tu contexto</CardTitle>
            <CardDescription>Tienes más de una comunidad u organización asignada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {selection.memberships.map((membership) => (
                <Button
                  key={membership.id}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={loading}
                  onClick={() => handleSelect(membership.id)}
                >
                  <span className="font-mono text-xs uppercase mr-2">{membership.role}</span>
                  <span className="text-xs text-muted-foreground">
                    {membership.communityId ?? membership.organizationId}
                  </span>
                </Button>
              ))}
              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  <RiErrorWarningLine className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <div
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
        role="tablist"
        aria-label="Acceso"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          onClick={() => switchMode('login')}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-medium transition-colors',
            mode === 'login'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          onClick={() => switchMode('signup')}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-medium transition-colors',
            mode === 'signup'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Crear cuenta
        </button>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-xl">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear cuenta'}
          </CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Ingresa tus credenciales para acceder al panel'
              : 'Ingresa el código de invitación que te compartió tu comunidad'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'login' ? (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@porteria.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'login-error' : undefined}
                    required
                  />
                </Field>
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                    <a href="#" className="ml-auto text-sm underline-offset-4 hover:underline">
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'login-error' : undefined}
                    required
                  />
                </Field>
                {error && (
                  <Field>
                    <div
                      id="login-error"
                      role="alert"
                      aria-live="assertive"
                      className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      <RiErrorWarningLine className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  </Field>
                )}
                <Field>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />}
                    {loading ? 'Ingresando…' : 'Ingresar'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="invite-token">Código o enlace de invitación</FieldLabel>
                  <Input
                    id="invite-token"
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="Pega el código o el enlace"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'signup-error' : undefined}
                    required
                  />
                  <FieldDescription>
                    Si no tienes una invitación, pídesela al administrador de tu comunidad.
                  </FieldDescription>
                </Field>
                {error && (
                  <Field>
                    <div
                      id="signup-error"
                      role="alert"
                      aria-live="assertive"
                      className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      <RiErrorWarningLine className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  </Field>
                )}
                <Field>
                  <Button type="submit" className="w-full">
                    Continuar
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Al continuar, aceptas nuestros <a href="#">Términos de Servicio</a> y{' '}
        <a href="#">Políticas de Privacidad</a>.
      </FieldDescription>
    </div>
  );
}
