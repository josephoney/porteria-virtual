import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiAddLine } from '@remixicon/react';
import { ApiError, get } from '../lib/apiClient';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/layout/PageHeader';
import { Skeleton } from '../components/ui/skeleton';

interface ResidentPass {
  id: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorDocument: string;
  validFrom: string;
  validUntil: string;
  status: string;
  destination?: { id: string; name: string; path: string; kind: 'home' | 'common_area' };
}

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const STATUS_LABELS: Record<string, string> = {
  active: 'Vigente',
  used: 'Usada',
  revoked: 'Revocada',
  expired: 'Vencida',
};

export function ResidentAuthorizationsPage() {
  const [passes, setPasses] = useState<ResidentPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await get<ResidentPass[]>('/api/passes?pageSize=20');
        if (!cancelled) setPasses(result.data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setDisabled(true);
        } else {
          setError('No se pudo cargar el historial.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Autorizaciones"
        description="Todo lo que autorizaste, con su destino y su ventana de validez."
        actions={
          <Button asChild>
            <Link to="/resident/authorizations/new">
              <RiAddLine /> Autorizar visita
            </Link>
          </Button>
        }
      />

      {disabled && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Las autorizaciones con QR están desactivadas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu administrador todavía no habilitó este módulo en la comunidad.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {!disabled && !error && loading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!disabled && !error && !loading && passes.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium">Todavía no hay autorizaciones</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando autorices una visita, va a quedar registrada acá.
          </p>
        </div>
      )}

      {!disabled && !error && !loading && passes.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {passes.map((pass) => (
            <li key={pass.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {pass.visitorFirstName} {pass.visitorLastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {pass.destination?.path ?? 'Destino'} · Doc. {pass.visitorDocument}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dateFormat.format(new Date(pass.validFrom))} —{' '}
                  {dateFormat.format(new Date(pass.validUntil))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {pass.destination?.kind === 'common_area' ? 'Zona común' : 'Vivienda'}
                </Badge>
                <Badge variant={pass.status === 'active' ? 'default' : 'outline'}>
                  {STATUS_LABELS[pass.status] ?? pass.status}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
