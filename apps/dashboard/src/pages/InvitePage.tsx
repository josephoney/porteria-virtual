import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CONFIG } from '../config';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  fieldA11y,
  hasErrors,
  minLengthError,
  optionalDocumentError,
  optionalPhoneError,
  requiredError,
} from '../lib/form';

interface PreviewUnit {
  id: string;
  code: string;
  path: string;
}

interface Preview {
  communityName: string;
  unitCode: string | null;
  locationPath: string | null;
  units: PreviewUnit[];
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
  const [phone, setPhone] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    password: '',
    phone: '',
    documentNumber: '',
  });
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

    const validation = {
      name: requiredError(name, 'El nombre'),
      password:
        requiredError(password, 'La contraseña') || minLengthError(password, 8, 'La contraseña'),
      phone: optionalPhoneError(phone),
      documentNumber: optionalDocumentError(documentNumber),
    };
    setFieldErrors(validation);
    if (hasErrors(validation)) return;

    setError('');
    setLoading(true);
    try {
      await acceptInvitation(token, name, password, {
        phone: phone.trim() || undefined,
        documentNumber: documentNumber.trim() || undefined,
      });
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
            {preview.role} · {preview.maskedEmail}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {preview.units.length === 1 ? 'Unidad' : 'Unidades'}
            </p>
            {preview.units.length > 0 ? (
              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-sm">
                {preview.units.map((unit) => (
                  <li key={unit.id} className="flex items-baseline justify-between gap-3">
                    <span>{unit.path}</span>
                    {unit.code && unit.code !== unit.path && (
                      <span className="font-mono text-xs text-muted-foreground">{unit.code}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm">
                {preview.locationPath ??
                  (preview.unitCode ? `Unidad ${preview.unitCode}` : 'Sin unidad asignada')}
              </p>
            )}
          </div>
          {isAuthenticated ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ya iniciaste sesión. Acepta la invitación con tu cuenta actual.
              </p>
              <Button className="w-full" onClick={handleExistingAccount} disabled={loading}>
                {loading ? 'Aceptando…' : 'Aceptar con mi cuenta'}
              </Button>
            </>
          ) : (
            <form onSubmit={handleNewAccount} className="space-y-3" noValidate>
              <div className="space-y-1">
                <Label htmlFor="invite-name">Nombre</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((current) => ({ ...current, name: '' }));
                  }}
                  required
                  {...fieldA11y('invite-name', fieldErrors.name)}
                />
                {fieldErrors.name && (
                  <p id="invite-name-error" role="alert" className="text-xs text-destructive">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-password">Contraseña</Label>
                <Input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((current) => ({ ...current, password: '' }));
                  }}
                  required
                  minLength={8}
                  {...fieldA11y('invite-password', fieldErrors.password)}
                />
                <p className="text-xs text-muted-foreground">Mínimo ocho caracteres.</p>
                {fieldErrors.password && (
                  <p id="invite-password-error" role="alert" className="text-xs text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-phone">Teléfono</Label>
                <Input
                  id="invite-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setFieldErrors((current) => ({ ...current, phone: '' }));
                  }}
                  placeholder="Opcional"
                  {...fieldA11y('invite-phone', fieldErrors.phone)}
                />
                {fieldErrors.phone && (
                  <p id="invite-phone-error" role="alert" className="text-xs text-destructive">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-document">Documento</Label>
                <Input
                  id="invite-document"
                  value={documentNumber}
                  onChange={(e) => {
                    setDocumentNumber(e.target.value);
                    setFieldErrors((current) => ({ ...current, documentNumber: '' }));
                  }}
                  placeholder="Opcional"
                  {...fieldA11y('invite-document', fieldErrors.documentNumber)}
                />
                {fieldErrors.documentNumber && (
                  <p id="invite-document-error" role="alert" className="text-xs text-destructive">
                    {fieldErrors.documentNumber}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creando cuenta…' : 'Crear cuenta y aceptar'}
              </Button>
            </form>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground text-center">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="underline">
              Inicia sesión
            </Link>{' '}
            y vuelve a abrir este enlace.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
