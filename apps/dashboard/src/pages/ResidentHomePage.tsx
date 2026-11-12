import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiAddLine, RiArrowRightLine, RiHistoryLine, RiQrCodeLine } from '@remixicon/react';
import { ApiError, get } from '../lib/apiClient';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/layout/PageHeader';
import { Skeleton } from '../components/ui/skeleton';

interface ResidentPass {
  id: string;
  visitorFirstName: string;
  visitorLastName: string;
  validFrom: string;
  validUntil: string;
  status: string;
  destination?: { id: string; name: string; path: string; kind: 'home' | 'common_area' };
}

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatRange(from: string, until: string) {
  return `${dateFormat.format(new Date(from))} — ${dateFormat.format(new Date(until))}`;
}

export function ResidentHomePage() {
  const [passes, setPasses] = useState<ResidentPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await get<ResidentPass[]>('/api/passes?status=active&pageSize=5');
        if (!cancelled) setPasses(result.data);
      } catch (err) {
        if (cancelled) return;
        // The whole pass surface is behind the dynamic QR flag. When it is off
        // the API answers 404, so the resident sees a neutral explanation
        // instead of an error.
        if (err instanceof ApiError && err.status === 404) {
          setDisabled(true);
        } else {
          setError('No se pudieron cargar tus autorizaciones.');
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
    <div className="space-y-6">
      <PageHeader
        title="Mis autorizaciones"
        description="Autorizá visitas a tu vivienda o a las zonas comunes de la comunidad."
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
            Tu administrador todavía no habilitó este módulo en la comunidad. Cuando lo haga, vas a
            poder autorizar visitas desde acá.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {!disabled && !error && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/resident/authorizations/new"
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <RiQrCodeLine className="size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Autorizar una visita</p>
            <p className="text-xs text-muted-foreground">Elegí el destino y generá el QR.</p>
          </Link>
          <Link
            to="/resident/authorizations"
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <RiHistoryLine className="size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Historial</p>
            <p className="text-xs text-muted-foreground">
              Revisá, compartí o revocá lo autorizado.
            </p>
          </Link>
        </div>
      )}

      {!disabled && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Vigentes ahora</h2>
            <Button asChild variant="link" size="sm" className="h-auto px-0">
              <Link to="/resident/authorizations">
                Ver todo <RiArrowRightLine />
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : passes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">Todavía no autorizaste a nadie</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando autorices una visita, va a aparecer acá con su QR.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/resident/authorizations/new">Autorizar la primera visita</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {passes.map((pass) => (
                <li key={pass.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {pass.visitorFirstName} {pass.visitorLastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {pass.destination?.path ?? 'Destino'} ·{' '}
                      {formatRange(pass.validFrom, pass.validUntil)}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {pass.destination?.kind === 'common_area' ? 'Zona común' : 'Vivienda'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
