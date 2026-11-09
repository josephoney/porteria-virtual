import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from '../components/login-form';
import { CONFIG } from '../config';
import { Button } from '../components/ui/button';

interface PublicCommunity {
  id: string;
  name: string;
  slug: string;
  address: string;
  timezone: string;
  organization: { id: string; name: string; slug: string };
}

type PageStatus = 'loading' | 'ready' | 'not_found' | 'error';

export function CommunityEntryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, isLoading } = useAuth();
  const [community, setCommunity] = useState<PublicCommunity | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!slug) {
      setStatus('not_found');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    fetch(`${CONFIG.API_URL}/api/public/communities/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setStatus('not_found');
          return;
        }
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const data = (await res.json()) as PublicCommunity;
        if (cancelled) return;
        setCommunity(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [slug, retryKey]);

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;

  if (status === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-extrabold">Comunidad no encontrada</h1>
          <p className="text-sm text-muted-foreground">
            Verificá el enlace o pedile uno nuevo a la administración.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-extrabold">No se pudo conectar</h1>
          <p className="text-sm text-muted-foreground">
            No pudimos hablar con el servidor. Revisá que la API esté corriendo en el puerto
            3000 y reintentá.
          </p>
          <Button variant="outline" onClick={() => setRetryKey((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'loading' || !community) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="font-mono text-xs text-muted-foreground">Cargando comunidad…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground">
            {community.organization.name}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">{community.name}</h1>
          <p className="text-sm text-muted-foreground">{community.address}</p>
        </div>
        <LoginForm communitySlug={community.slug} />
      </div>
    </div>
  );
}
