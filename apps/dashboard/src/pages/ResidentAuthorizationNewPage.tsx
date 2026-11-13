import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, get, post } from '../lib/apiClient';
import { Button } from '../components/ui/button';
import { DetailField, DetailGrid } from '../components/ui/detail-field';
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

type Step = 'form' | 'review';

type FieldKey = 'destination' | 'visitor' | 'window' | 'vehicle';

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatWindow(from: string, until: string) {
  const fromDate = new Date(from);
  const untilDate = new Date(until);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(untilDate.getTime())) return '';

  return `${dateTimeFormatter.format(fromDate)} → ${dateTimeFormatter.format(untilDate)}`;
}

/**
 * Pass errors travel as a machine-readable `message` (for example
 * `destination_inactive`), so they are mapped to the field that caused them
 * instead of showing the raw code.
 */
function destinationErrorFor(code: string): string | null {
  switch (code) {
    case 'destination_inactive':
      return 'Ese destino se archivó y ya no recibe autorizaciones. Elegí otro.';
    case 'not_found':
    case 'foreign_community':
      return 'No encontramos ese destino en tu comunidad. Elegí otro.';
    case 'forbidden':
      return 'No podés autorizar visitas a ese destino.';
    case 'invalid':
      return 'Ese destino no acepta autorizaciones. Elegí una vivienda o una zona común.';
    default:
      return null;
  }
}

export function ResidentAuthorizationNewPage() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);

  const [destinationId, setDestinationId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [document, setDocument] = useState('');
  const [hasVehicle, setHasVehicle] = useState(false);
  const [plate, setPlate] = useState('');
  const [type, setType] = useState('entry_only');
  const [maxUses, setMaxUses] = useState('1');
  const [validFrom, setValidFrom] = useState(toLocalInput(now));
  const [validUntil, setValidUntil] = useState(
    toLocalInput(new Date(now.getTime() + 4 * 60 * 60 * 1000)),
  );

  const loadDestinations = useCallback(async () => {
    try {
      const result = await get<Destination[]>('/api/passes/destinations');
      // Radix clears a value that has no mounted `SelectItem`, so the select
      // stays empty and the resident picks the destination explicitly.
      setDestinations(result.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabled(true);
      } else {
        setError('No se pudieron cargar los destinos disponibles.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDestinations();
  }, [loadDestinations]);

  const homes = destinations.filter((destination) => destination.kind === 'home');
  const commonAreas = destinations.filter((destination) => destination.kind === 'common_area');
  const selectedDestination = destinations.find((destination) => destination.id === destinationId);

  function clearFieldError(key: FieldKey) {
    setFieldErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }

  function validate(): boolean {
    const next: Partial<Record<FieldKey, string>> = {};

    if (!destinationId) {
      next.destination = 'Elegí a dónde autorizás la visita.';
    }
    if (!firstName.trim() || !lastName.trim() || !document.trim()) {
      next.visitor = 'Completá nombre, apellido y documento del visitante.';
    }

    const from = new Date(validFrom);
    const until = new Date(validUntil);
    if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) {
      next.window = 'Completá la fecha y hora de la vigencia.';
    } else if (until.getTime() <= from.getTime()) {
      next.window = 'La vigencia debe terminar después de empezar.';
    }

    if (hasVehicle && !plate.trim()) {
      next.vehicle = 'Ingresá la patente del vehículo.';
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleReview(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!validate()) return;
    setStep('review');
  }

  async function handleConfirm() {
    setError('');
    setFieldErrors({});
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
        ...(type === 'entry_exit' ? { maxUses: Number(maxUses) || 1 } : {}),
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
      });
      navigate('/resident/authorizations', { replace: true });
    } catch (err) {
      const code =
        err instanceof ApiError
          ? String((err.body as { message?: unknown } | null)?.message ?? '')
          : '';
      const destinationError = destinationErrorFor(code);

      if (destinationError) {
        setFieldErrors({ destination: destinationError });
        setStep('form');
        void loadDestinations();
      } else {
        setError(messageForError(err, code));
      }
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return (
      <div className="p-6 space-y-3">
        <PageHeader title="Autorizar visita" />
        <div className="rounded-4xl border border-border bg-card p-6">
          <p className="text-sm font-medium">Las autorizaciones con QR están desactivadas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu administrador todavía no habilitó este módulo en la comunidad.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Autorizar visita"
        description="Elegí el destino, cargá los datos del visitante y definí la ventana de validez."
      />

      <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <li
          aria-current={step === 'form' ? 'step' : undefined}
          className={step === 'form' ? 'font-medium text-foreground' : undefined}
        >
          1. Datos
        </li>
        <li aria-hidden="true">→</li>
        <li
          aria-current={step === 'review' ? 'step' : undefined}
          className={step === 'review' ? 'font-medium text-foreground' : undefined}
        >
          2. Confirmación
        </li>
      </ol>

      {step === 'review' ? (
        <section className="max-w-2xl space-y-4">
          <div className="rounded-4xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Revisá la autorización</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Si está todo bien, confirmá. Podés volver para cambiar cualquier dato.
            </p>

            <DetailGrid className="mt-4">
              <DetailField
                label="Visitante"
                value={`${firstName.trim()} ${lastName.trim()}`.trim()}
              />
              <DetailField label="Documento" value={document.trim()} />
              <DetailField label="Destino" value={selectedDestination?.path ?? ''} span="full" />
              <DetailField
                label="Vigencia"
                value={formatWindow(validFrom, validUntil)}
                span="full"
              />
              <DetailField
                label="Tipo"
                value={type === 'entry_exit' ? 'Ingreso y egreso' : 'Solo ingreso'}
              />
              <DetailField
                label="Usos"
                value={
                  type === 'entry_exit'
                    ? `${maxUses} ${Number(maxUses) === 1 ? 'uso' : 'usos'}`
                    : 'Un solo uso'
                }
              />
              <DetailField
                label="Vehículo"
                value={hasVehicle ? plate.trim().toUpperCase() : 'No ingresa en vehículo'}
              />
            </DetailGrid>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void handleConfirm()} disabled={saving}>
              {saving ? 'Autorizando…' : 'Confirmar y autorizar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('form')} disabled={saving}>
              Volver
            </Button>
          </div>
        </section>
      ) : (
        <form
          onSubmit={handleReview}
          className="max-w-2xl space-y-5 rounded-4xl border border-border bg-card p-6"
        >
          <div className="space-y-1">
            <Label htmlFor="resident-destination">Destino</Label>
            <Select
              value={destinationId}
              onValueChange={(value) => {
                setDestinationId(value);
                clearFieldError('destination');
              }}
              disabled={loading || destinations.length === 0}
            >
              <SelectTrigger
                id="resident-destination"
                aria-label="Destino"
                aria-invalid={Boolean(fieldErrors.destination)}
              >
                <SelectValue placeholder="Elegí un destino">
                  {selectedDestination?.path}
                </SelectValue>
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
            {fieldErrors.destination && (
              <p id="resident-destination-error" role="alert" className="text-xs text-destructive">
                {fieldErrors.destination}
              </p>
            )}
            {!loading && destinations.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Tu comunidad todavía no tiene destinos disponibles. Pedile al administrador que
                defina la estructura en Unidades.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="resident-visitor-first">Nombre</Label>
              <Input
                id="resident-visitor-first"
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  clearFieldError('visitor');
                }}
                aria-invalid={Boolean(fieldErrors.visitor)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="resident-visitor-last">Apellido</Label>
              <Input
                id="resident-visitor-last"
                value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                  clearFieldError('visitor');
                }}
                aria-invalid={Boolean(fieldErrors.visitor)}
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="resident-visitor-document">Documento</Label>
              <Input
                id="resident-visitor-document"
                value={document}
                onChange={(event) => {
                  setDocument(event.target.value);
                  clearFieldError('visitor');
                }}
                aria-invalid={Boolean(fieldErrors.visitor)}
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
            <div className="space-y-1">
              <Label htmlFor="resident-max-uses">Usos permitidos</Label>
              <Input
                id="resident-max-uses"
                type="number"
                min={1}
                max={20}
                value={type === 'entry_only' ? '1' : maxUses}
                disabled={type === 'entry_only'}
                onChange={(event) => setMaxUses(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {type === 'entry_only'
                  ? 'Pase de ingreso, un solo uso'
                  : 'Un uso es una entrada y una salida.'}
              </p>
            </div>
          </div>

          {fieldErrors.visitor && (
            <p id="resident-visitor-error" role="alert" className="text-xs text-destructive">
              {fieldErrors.visitor}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="resident-valid-from">Válida desde</Label>
              <Input
                id="resident-valid-from"
                type="datetime-local"
                value={validFrom}
                onChange={(event) => {
                  setValidFrom(event.target.value);
                  clearFieldError('window');
                }}
                aria-invalid={Boolean(fieldErrors.window)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="resident-valid-until">Válida hasta</Label>
              <Input
                id="resident-valid-until"
                type="datetime-local"
                value={validUntil}
                onChange={(event) => {
                  setValidUntil(event.target.value);
                  clearFieldError('window');
                }}
                aria-invalid={Boolean(fieldErrors.window)}
                required
              />
            </div>
          </div>

          {fieldErrors.window && (
            <p id="resident-window-error" role="alert" className="text-xs text-destructive">
              {fieldErrors.window}
            </p>
          )}

          <div className="space-y-2 rounded-lg border border-border bg-card p-3">
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
                  onChange={(event) => {
                    setPlate(event.target.value);
                    clearFieldError('vehicle');
                  }}
                  aria-invalid={Boolean(fieldErrors.vehicle)}
                  required
                />
                {fieldErrors.vehicle && (
                  <p role="alert" className="text-xs text-destructive">
                    {fieldErrors.vehicle}
                  </p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={saving || loading}>
              Revisar autorización
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/resident')}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function messageForError(err: unknown, code: string) {
  switch (code) {
    case 'daily_limit_reached':
      return 'Esta unidad alcanzó el límite de autorizaciones por hoy. Probá de nuevo mañana.';
    case 'recurring_not_available':
    case 'allowed_days_reserved':
      return 'Ese tipo de autorización todavía no está disponible desde la web.';
    case 'rate_limited':
      return 'Demasiados intentos seguidos. Esperá un minuto y volvé a intentar.';
    case 'dynamic_qr_disabled':
      return 'Las autorizaciones con QR están desactivadas en esta comunidad.';
    default:
      if (err instanceof ApiError && err.message && !/^[a-z_]+$/.test(err.message)) {
        return err.message;
      }
      return 'No se pudo crear la autorización. Reintentá en unos segundos.';
  }
}
