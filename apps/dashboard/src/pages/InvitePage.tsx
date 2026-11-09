import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CONFIG } from '../config';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface Preview {
  communityName: string;
  unitCode: string | null;
  locationPath: string | null;
  role: string;
  maskedEmail: string;
  expiresAt: string;
}

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, acceptInvitation } = useAuth();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      return;
    }
    fetch(`${CONFIG.API_URL}/api/public/invitations/${encodeURIComponent(token)}`)
      .then((res) => {
        if (!res.ok) throw new Error('invalid');
        return res.json();
      })
      .then((data: Preview) => setPreview(data))
      .catch(() => setInvalid(true));
  }, [token]);

  async function handleNewAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setLoading(true);
    try {
      await acceptInvitation(token, name, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación');
    } finally {
      setLoading(false);
    }
  }

  async function handleExistingAccount() {
    if (!token) return;
    setError('');
    setLoading(true);
    try {
      await acceptInvitation(token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la invitación');
    } finally {
      setLoading(false);
    }
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-extrabold">Invitación inválida</h1>
          <p className="text-sm text-muted-foreground">
            El enlace expiró, fue revocado o ya se usó.
          </p>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="font-mono text-xs text-muted-foreground">Cargando invitación…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Invitación a {preview.communityName}</CardTitle>
          <CardDescription>
            {preview.role}
            {preview.locationPath
              ? ` · ${preview.locationPath}`
              : preview.unitCode
                ? ` · Unidad ${preview.unitCode}`
                : ''}{' '}
            · {preview.maskedEmail}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAuthenticated ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ya iniciaste sesión. Aceptá la invitación con tu cuenta actual.
              </p>
              <Button className="w-full" onClick={handleExistingAccount} disabled={loading}>
                {loading ? 'Aceptando…' : 'Aceptar con mi cuenta'}
              </Button>
            </>
          ) : (
            <form onSubmit={handleNewAccount} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="invite-name">Nombre</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-password">Contraseña</Label>
                <Input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creando cuenta…' : 'Crear cuenta y aceptar'}
              </Button>
            </form>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <p className="text-xs text-muted-foreground text-center">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="underline">
              Iniciá sesión
            </Link>{' '}
            y volvé a abrir este enlace.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
