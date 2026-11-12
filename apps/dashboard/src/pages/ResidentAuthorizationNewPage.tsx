import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, get, post } from '../lib/apiClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

interface Destination {
  id: string;
  name: string;
  path: string;
  kind: 'home' | 'common_area';
}

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function ResidentAuthorizationNewPage() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [destinationId, setDestinationId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [document, setDocument] = useState('');
  const [hasVehicle, setHasVehicle] = useState(false);
  const [plate, setPlate] = useState('');
  const [type, setType] = useState('entry_only');
  const [validFrom, setValidFrom] = useState(toLocalInput(now));
  const [validUntil, setValidUntil] = useState(
    toLocalInput(new Date(now.getTime() + 4 * 60 * 60 * 1000)),
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await get<Destination[]>('/api/passes/destinations');
        if (cancelled) return;
        setDestinations(result.data);
        setDestinationId((current) => current || (result.data[0]?.id ?? ''));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setDisabled(true);
        } else {
          setError('No se pudieron cargar los destinos disponibles.');
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

  const homes = destinations.filter((destination) => destination.kind === 'home');
  const commonAreas = destinations.filter((destination) => destination.kind === 'common_area');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!destinationId) {
      setError('Elegí a dónde autorizás la visita.');
      return;
    }
    if (hasVehicle && !plate.trim()) {
      setError('Ingresá la patente del vehículo.');
      return;
    }

    setSaving(true);
    try {
      await post('/api/passes', {
        locationUnitId: destinationId,
        visitorFirstName: firstName.trim(),
        visitorLastName: lastName.trim(),
        visitorDocument: document.trim(),
        hasVehicle,
        vehiclePlate: hasVehicle ? plate.trim().toUpperCase() : null,
        type,
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
      });
      navigate('/resident/authorizations', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la autorización.');
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return (
      <div className="space-y-3">
        <PageHeader title="Autorizar visita" />
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Las autorizaciones con QR están desactivadas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu administrador todavía no habilitó este módulo en la comunidad.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Autorizar visita"
        description="Elegí el destino, cargá los datos del visitante y definí la ventana de validez."
      />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div className="space-y-1">
          <Label htmlFor="resident-destination">Destino</Label>
          <Select
            value={destinationId}
            onValueChange={setDestinationId}
            disabled={loading || destinations.length === 0}
          >
            <SelectTrigger id="resident-destination" aria-label="Destino">
              <SelectValue placeholder="Elegí un destino" />
            </SelectTrigger>
            <SelectContent>
              {homes.length > 0 && (
                <>
                  <SelectItem value="__homes" disabled>
                    Mi vivienda
                  </SelectItem>
                  {homes.map((destination) => (
                    <SelectItem key={destination.id} value={destination.id}>
                      {destination.path}
                    </SelectItem>
                  ))}
                </>
              )}
              {commonAreas.length > 0 && (
                <>
                  <SelectItem value="__common" disabled>
                    Zonas comunes
                  </SelectItem>
                  {commonAreas.map((destination) => (
                    <SelectItem key={destination.id} value={destination.id}>
                      {destination.path}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          {!loading && destinations.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Tu comunidad todavía no tiene destinos disponibles. Pedile al administrador que defina
              la estructura en Unidades.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="resident-visitor-first">Nombre</Label>
            <Input
              id="resident-visitor-first"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="resident-visitor-last">Apellido</Label>
            <Input
              id="resident-visitor-last"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="resident-visitor-document">Documento</Label>
            <Input
              id="resident-visitor-document"
              value={document}
              onChange={(event) => setDocument(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="resident-pass-type">Tipo de autorización</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="resident-pass-type" aria-label="Tipo de autorización">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entry_only">Solo ingreso</SelectItem>
                <SelectItem value="entry_exit">Ingreso y egreso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="resident-valid-from">Válida desde</Label>
            <Input
              id="resident-valid-from"
              type="datetime-local"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="resident-valid-until">Válida hasta</Label>
            <Input
              id="resident-valid-until"
              type="datetime-local"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasVehicle}
              onChange={(event) => setHasVehicle(event.target.checked)}
            />
            Ingresa en vehículo
          </label>
          {hasVehicle && (
            <div className="space-y-1">
              <Label htmlFor="resident-vehicle-plate">Patente</Label>
              <Input
                id="resident-vehicle-plate"
                value={plate}
                onChange={(event) => setPlate(event.target.value)}
                required
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving || loading}>
            {saving ? 'Autorizando…' : 'Autorizar visita'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/resident')}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
