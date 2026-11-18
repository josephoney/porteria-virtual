import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  RiAddLine,
  RiArrowRightLine,
  RiFileList3Line,
  RiHistoryLine,
  RiQrCodeLine,
} from '@remixicon/react';
import { ApiError, get } from '../lib/apiClient';
import { isPermanentPass } from '@porteria/shared';
import { usePassStream } from '../lib/use-pass-stream';
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
  const start = dateFormat.format(new Date(from));
  if (isPermanentPass(until)) return `${start} — sin fecha de fin`;
  return `${start} — ${dateFormat.format(new Date(until))}`;
}

interface QuickActionProps {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
}

function QuickAction({ to, icon, title, description }: QuickActionProps) {
  return (
    <Link
      to={to}
      className="rounded-4xl border border-border bg-card p-5 transition-colors hover:bg-muted/40"
    >
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

export function ResidentHomePage() {
  const [passes, setPasses] = useState<ResidentPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

  // A pass used at the gate has to leave this list while the resident is looking
  // at it, without a reload.
  usePassStream({
    enabled: !disabled,
    onEvent: () => {
      setReloadKey((value) => value + 1);
    },
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Mis autorizaciones"
        description="Autoriza visitas a tu vivienda o a las zonas comunes de la comunidad."
        actions={
          <Button asChild>
            <Link to="/resident/authorizations/new">
              <RiAddLine /> Autorizar visita
            </Link>
          </Button>
        }
      />

      {disabled && (
        <div className="rounded-4xl border border-border bg-card p-6">
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
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickAction
            to="/resident/authorizations/new"
            icon={<RiQrCodeLine className="size-5" />}
            title="Autorizar una visita"
            description="Elige el destino y genera el QR."
          />
          <QuickAction
            to="/resident/authorizations"
            icon={<RiHistoryLine className="size-5" />}
            title="Historial"
            description="Revisa, comparte o revoca lo autorizado."
          />
          <QuickAction
            to="/resident/authorizations/bulk"
            icon={<RiFileList3Line className="size-5" />}
            title="Carga masiva"
            description="Autoriza un grupo de visitas con un CSV."
          />
        </div>
      )}

      {!disabled && (
        <section className="space-y-3">
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
            <div className="rounded-4xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">Todavía no autorizaste a nadie</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando autorices una visita, va a aparecer acá con su QR.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/resident/authorizations/new">Autorizar la primera visita</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-4xl border border-border bg-card">
              {passes.map((pass) => (
                <li key={pass.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
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
