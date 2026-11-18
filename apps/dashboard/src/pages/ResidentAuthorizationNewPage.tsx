import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERMANENT_PASS_UNTIL, isPermanentPass } from '@porteria/shared';
import { cn } from 'cn';
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
type Duration = 'today' | 'tomorrow' | 'range' | 'recurrent';
type Recurrence = 'once' | 'range' | 'weekly';
type FieldKey =
  | 'destination'
  | 'visitor'
  | 'window'
  | 'vehicle'
  | 'schedule'
  | 'days'
  | 'recurrenceUntil'
  | 'uses';

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const DURATIONS: Array<{ value: Duration; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: 'tomorrow', label: 'Mañana' },
  { value: 'range', label: 'Varios días' },
  { value: 'recurrent', label: 'Recurrente' },
];

/** Monday first, as the resident reads a calendar. `0` is Sunday in the database. */
const WEEKDAYS: Array<{ value: number; short: string; name: string }> = [
  { value: 1, short: 'L', name: 'lunes' },
  { value: 2, short: 'M', name: 'martes' },
  { value: 3, short: 'X', name: 'miércoles' },
  { value: 4, short: 'J', name: 'jueves' },
  { value: 5, short: 'V', name: 'viernes' },
  { value: 6, short: 'S', name: 'sábado' },
  { value: 0, short: 'D', name: 'domingo' },
];

const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTE_STEPS = ['00', '15', '30', '45'];

interface TimeParts {
  hour: string;
  minute: string;
  meridiem: 'AM' | 'PM';
}

/** `input type="time"` follows the OS locale, so the page builds its own AM/PM control. */
function splitTime(value: string): TimeParts {
  if (!value) return { hour: '', minute: '00', meridiem: 'AM' };
  const [hours, minutes] = value.slice(0, 5).split(':');
  const hour24 = Number(hours);
  return {
    hour: String(hour24 % 12 === 0 ? 12 : hour24 % 12).padStart(2, '0'),
    minute: MINUTE_STEPS.includes(minutes) ? minutes : '00',
    meridiem: hour24 >= 12 ? 'PM' : 'AM',
  };
}

function joinTime(hour: string, minute: string, meridiem: 'AM' | 'PM') {
  const hour24 = (Number(hour) % 12) + (meridiem === 'PM' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${minute}`;
}

interface TimeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * Native time inputs render in 12 or 24 hours depending on the operating system,
 * so the format cannot be forced with an attribute. Three selects keep AM/PM
 * stable for every resident; the value remains a 24-hour `HH:MM` string.
 */
function TimeField({ id, label, value, onChange, invalid, disabled }: TimeFieldProps) {
  const { hour, minute, meridiem } = splitTime(value);

  function update(next: Partial<TimeParts>) {
    const nextHour = next.hour ?? hour;
    if (!nextHour) {
      onChange('');
      return;
    }
    onChange(joinTime(nextHour, next.minute ?? minute, next.meridiem ?? meridiem));
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="whitespace-nowrap">
        {label}
      </Label>
      <div className="flex items-center gap-1">
        <Select
          value={hour || 'none'}
          onValueChange={(next) => update({ hour: next === 'none' ? '' : next })}
          disabled={disabled}
        >
          <SelectTrigger
            id={id}
            aria-label={`${label}: hora`}
            aria-invalid={invalid}
            className="w-[4.5rem]"
          >
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent className="min-w-0">
            <SelectItem value="none">--</SelectItem>
            {HOURS_12.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">:</span>
        <Select
          value={minute}
          onValueChange={(next) => update({ minute: next })}
          disabled={disabled || !hour}
        >
          <SelectTrigger aria-label={`${label}: minutos`} className="w-[4.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-0">
            {MINUTE_STEPS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={meridiem}
          onValueChange={(next) => update({ meridiem: next as 'AM' | 'PM' })}
          disabled={disabled || !hour}
        >
          <SelectTrigger aria-label={`${label}: AM o PM`} className="w-[5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-0">
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Local wall clock in the 24-hour `HH:MM` format the API expects. */
function timeOfDay(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function formatRuleDate(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatWindow(from: Date, until: Date) {
  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) return '';
  if (isPermanentPass(until)) return `${dateTimeFormatter.format(from)} → sin fecha de fin`;
  return `${dateTimeFormatter.format(from)} → ${dateTimeFormatter.format(until)}`;
}

function describeDays(days: number[]) {
  const names = WEEKDAYS.filter((day) => days.includes(day.value)).map((day) => day.name);
  if (names.length === 0) return 'Ningún día';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

interface RuleDescription {
  recurrence: Recurrence;
  allowedDays: number[];
  scheduleFrom: string;
  scheduleTo: string;
  maxUses: number;
  entryOnly: boolean;
  start: Date;
  end: Date;
  immediate: boolean;
}

/** Mirrors the wording the API uses in the pass detail, so review and detail agree. */
function describeRule(rule: RuleDescription) {
  const permanent = isPermanentPass(rule.end);
  const sameDay = formatRuleDate(rule.start) === formatRuleDate(rule.end);
  const range = permanent
    ? `desde el ${formatRuleDate(rule.start)} de forma permanente`
    : sameDay
      ? `del ${formatRuleDate(rule.start)}`
      : `del ${formatRuleDate(rule.start)} al ${formatRuleDate(rule.end)}`;
  let when: string;
  if (rule.recurrence === 'weekly') {
    when = `${describeDays(rule.allowedDays)} ${range}`;
  } else if (rule.recurrence === 'range') {
    when = `Todos los días ${range}`;
  } else if (rule.immediate) {
    when = `Desde ahora hasta el ${formatRuleDate(rule.end)}`;
  } else {
    when = `Vigencia única ${range}`;
  }

  const hours = rule.immediate
    ? rule.scheduleTo
      ? `desde la confirmación hasta ${rule.scheduleTo}`
      : 'en cualquier horario'
    : rule.scheduleFrom && rule.scheduleTo
      ? `de ${rule.scheduleFrom} a ${rule.scheduleTo}`
      : 'en cualquier horario';
  const uses = rule.entryOnly
    ? 'sólo entrada'
    : rule.recurrence === 'once'
      ? `${rule.maxUses} ${rule.maxUses === 1 ? 'uso' : 'usos'} en total`
      : `hasta ${rule.maxUses} ${rule.maxUses === 1 ? 'uso' : 'usos'} por día`;

  return `${when.charAt(0).toUpperCase()}${when.slice(1)}, ${hours} · ${uses}.`;
}

interface WindowInput {
  duration: Duration;
  immediateEntry: boolean;
  scheduleFrom: string;
  rangeFrom: string;
  rangeUntil: string;
  recurrenceFrom: string;
  recurrenceUntil: string;
  now: Date;
}

function computeWindow(input: WindowInput): { start: Date; end: Date } {
  const startTime = input.scheduleFrom || '00:00';

  if (input.duration === 'today') {
    // Without a start hour there is nothing to delay, so immediate is the only
    // coherent start.
    const start =
      input.immediateEntry || !input.scheduleFrom
        ? input.now
        : combineDateAndTime(input.now, startTime);
    return { start, end: endOfDay(input.now) };
  }

  if (input.duration === 'tomorrow') {
    const day = addDays(input.now, 1);
    return { start: combineDateAndTime(day, startTime), end: endOfDay(day) };
  }

  if (input.duration === 'range') {
    const from = parseDateInput(input.rangeFrom);
    const until = parseDateInput(input.rangeUntil);
    return { start: combineDateAndTime(from, startTime), end: endOfDay(until) };
  }

  // Recurring passes start today when no start date is chosen, and never expire
  // when no end date is chosen; the weekdays live in `allowedDays`.
  const startDay = input.recurrenceFrom ? parseDateInput(input.recurrenceFrom) : input.now;
  return {
    start: combineDateAndTime(startDay, startTime),
    end: input.recurrenceUntil
      ? endOfDay(parseDateInput(input.recurrenceUntil))
      : new Date(PERMANENT_PASS_UNTIL),
  };
}

/**
 * Pass errors travel as a machine-readable `message` (for example
 * `destination_inactive`), so they are mapped to the field that caused them
 * instead of showing the raw code.
 */
function destinationErrorFor(code: string): string | null {
  switch (code) {
    case 'destination_inactive':
      return 'Ese destino se archivó y ya no recibe autorizaciones. Elige otro.';
    case 'not_found':
    case 'foreign_community':
      return 'No encontramos ese destino en tu comunidad. Elige otro.';
    case 'forbidden':
      return 'No puedes autorizar visitas a ese destino.';
    case 'invalid':
      return 'Ese destino no acepta autorizaciones. Elige una vivienda o una zona común.';
    default:
      return null;
  }
}

/** Zod validation details arrive as a list; the first one names the broken rule. */
function validationDetailMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const body = err.body as { details?: Array<{ message?: unknown }> } | null;
  const message = body?.details?.[0]?.message;
  return typeof message === 'string' ? message : null;
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

  const [duration, setDuration] = useState<Duration>('today');
  const [immediateEntry, setImmediateEntry] = useState(true);
  const [rangeFrom, setRangeFrom] = useState(toDateInput(now));
  const [rangeUntil, setRangeUntil] = useState(toDateInput(addDays(now, 1)));
  const [recurrenceFrom, setRecurrenceFrom] = useState('');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');

  const [allowedDays, setAllowedDays] = useState<number[]>([]);
  const [scheduleFrom, setScheduleFrom] = useState('');
  const [scheduleTo, setScheduleTo] = useState('');
  const [entryOnly, setEntryOnly] = useState(false);
  const [maxUses, setMaxUses] = useState('1');

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

  // The repetition menu was removed from the form: the validity mode already
  // says how the pass repeats, so sending both would let them contradict.
  const recurrence: Recurrence =
    duration === 'recurrent' ? 'weekly' : duration === 'range' ? 'range' : 'once';
  const isRecurrent = duration === 'recurrent';
  const immediateApplies = duration === 'today';
  const effectiveImmediate = immediateApplies && immediateEntry;

  const previewWindow = computeWindow({
    duration,
    immediateEntry: effectiveImmediate,
    scheduleFrom,
    rangeFrom,
    rangeUntil,
    recurrenceFrom,
    recurrenceUntil,
    now,
  });
  const previewRule = describeRule({
    recurrence,
    allowedDays,
    scheduleFrom,
    scheduleTo,
    maxUses: Number(maxUses) || 1,
    entryOnly,
    start: previewWindow.start,
    end: previewWindow.end,
    immediate: effectiveImmediate,
  });

  function clearFieldError(key: FieldKey) {
    setFieldErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }

  function selectDuration(next: Duration) {
    setDuration(next);
    // Immediate entry only makes sense for a pass that starts today. For the
    // other modes the start is the chosen hour on the start date.
    setImmediateEntry(next === 'today');
    clearFieldError('window');
    clearFieldError('days');
    clearFieldError('recurrenceUntil');
  }

  function toggleImmediateEntry(checked: boolean) {
    setImmediateEntry(checked);
    clearFieldError('window');
  }

  function toggleDay(day: number) {
    setAllowedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
    clearFieldError('days');
  }

  function validate(): boolean {
    const next: Partial<Record<FieldKey, string>> = {};

    if (!destinationId) {
      next.destination = 'Elige a dónde autorizas la visita.';
    }
    if (!firstName.trim() || !lastName.trim() || !document.trim()) {
      next.visitor = 'Completa nombre, apellido y documento del visitante.';
    }

    const window = computeWindow({
      duration,
      immediateEntry: effectiveImmediate,
      scheduleFrom,
      rangeFrom,
      rangeUntil,
      recurrenceFrom,
      recurrenceUntil,
      now,
    });

    if (duration === 'range') {
      if (!rangeFrom || !rangeUntil) {
        next.window = 'Elige la fecha de inicio y la de fin.';
      } else if (
        Number.isNaN(window.start.getTime()) ||
        Number.isNaN(window.end.getTime()) ||
        window.end.getTime() <= window.start.getTime()
      ) {
        next.window = 'La vigencia debe terminar después de empezar.';
      }
    }

    if (isRecurrent) {
      const startDay = recurrenceFrom
        ? parseDateInput(recurrenceFrom)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (recurrenceUntil) {
        const untilDay = parseDateInput(recurrenceUntil);
        if (
          Number.isNaN(startDay.getTime()) ||
          Number.isNaN(untilDay.getTime()) ||
          untilDay.getTime() < startDay.getTime()
        ) {
          next.recurrenceUntil = 'La fecha de fin debe ser igual o posterior a la de inicio.';
        }
      }
      if (allowedDays.length === 0) {
        next.days = 'Marca al menos un día de la semana.';
      }
    }

    const scheduleStart = effectiveImmediate ? timeOfDay(new Date()) : scheduleFrom;
    if (duration === 'today' && !effectiveImmediate && !scheduleFrom) {
      next.schedule = 'Elegí la hora de inicio o volvé a marcar Entrada inmediata.';
    } else if (
      !effectiveImmediate &&
      ((scheduleFrom && !scheduleTo) || (!scheduleFrom && scheduleTo))
    ) {
      next.schedule = 'Completa el horario o deja ambos campos vacíos.';
    } else if (scheduleTo && scheduleStart >= scheduleTo) {
      next.schedule = 'El horario debe empezar antes de terminar.';
    }

    const uses = Number(maxUses);
    if (!entryOnly && (!Number.isInteger(uses) || uses < 1 || uses > 20)) {
      next.uses = 'Elige entre 1 y 20 usos.';
    }

    if (hasVehicle && !plate.trim()) {
      next.vehicle = 'Ingresa la placa del vehículo.';
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
      // "Hoy" with immediate entry must use the exact creation instant, so the
      // window is computed here and not when the review step was rendered.
      const submittedAt = new Date();
      const window = computeWindow({
        duration,
        immediateEntry: effectiveImmediate,
        scheduleFrom,
        rangeFrom,
        rangeUntil,
        recurrenceFrom,
        recurrenceUntil,
        now: submittedAt,
      });
      // The start selector is disabled while the entry is immediate: the window
      // starts at the confirmation instant, and only its end can be chosen.
      const windowFrom = effectiveImmediate ? timeOfDay(submittedAt) : scheduleFrom;

      await post('/api/passes', {
        locationUnitId: destinationId,
        visitorFirstName: firstName.trim(),
        visitorLastName: lastName.trim(),
        visitorDocument: document.trim(),
        hasVehicle,
        vehiclePlate: hasVehicle ? plate.trim().toUpperCase() : null,
        type: entryOnly ? 'entry_only' : 'entry_exit',
        recurrence,
        ...(recurrence === 'weekly' ? { allowedDays } : {}),
        ...(windowFrom && scheduleTo ? { timeFrom: windowFrom, timeTo: scheduleTo } : {}),
        ...(entryOnly ? {} : { maxUses: Number(maxUses) || 1 }),
        validFrom: window.start.toISOString(),
        validUntil: window.end.toISOString(),
      });
      navigate('/resident/authorizations', { replace: true });
    } catch (err) {
      const code =
        err instanceof ApiError
          ? String((err.body as { message?: unknown } | null)?.message ?? '')
          : '';
      const destinationError = destinationErrorFor(code);
      const detail = validationDetailMessage(err);

      if (detail === 'weekly_requires_days') {
        setFieldErrors({ days: 'Marca al menos un día de la semana.' });
        setStep('form');
      } else if (destinationError) {
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
        description="Elige el destino, carga los datos del visitante y define cuándo y cuántas veces puede entrar."
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
            <h2 className="text-base font-semibold">Revisa la autorización</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Si está todo bien, confirma. Puedes volver para cambiar cualquier dato.
            </p>

            <DetailGrid className="mt-4">
              <DetailField
                label="Visitante"
                value={`${firstName.trim()} ${lastName.trim()}`.trim()}
              />
              <DetailField label="Documento" value={document.trim()} />
              <DetailField label="Destino" value={selectedDestination?.path ?? ''} span="full" />
              <DetailField label="Regla" value={previewRule} span="full" />
              <DetailField
                label="Vigencia"
                value={
                  effectiveImmediate
                    ? `Desde ahora hasta el ${formatRuleDate(previewWindow.end)} 23:59`
                    : formatWindow(previewWindow.start, previewWindow.end)
                }
                span="full"
              />
              <DetailField label="Tipo" value={entryOnly ? 'Sólo entrada' : 'Ingreso y egreso'} />
              <DetailField
                label="Usos"
                value={
                  entryOnly
                    ? 'Un solo uso'
                    : recurrence === 'once'
                      ? `${maxUses} en total`
                      : `${maxUses} por día`
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
                <SelectValue placeholder="Elige un destino">
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

          <div className="grid gap-3 sm:grid-cols-2">
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
              <Label htmlFor="resident-max-uses">
                {recurrence === 'once' ? 'Usos permitidos' : 'Usos por día'}
              </Label>
              <Input
                id="resident-max-uses"
                type="number"
                min={1}
                max={20}
                value={entryOnly ? '1' : maxUses}
                disabled={entryOnly}
                onChange={(event) => {
                  setMaxUses(event.target.value);
                  clearFieldError('uses');
                }}
                aria-invalid={Boolean(fieldErrors.uses)}
              />
              <p className="text-xs text-muted-foreground">
                {entryOnly
                  ? 'El pase se consume al entrar.'
                  : recurrence === 'once'
                    ? 'Se cuentan en total, sin importar el día.'
                    : 'Reinicia cada día. 1 uso = entrada y salida.'}
              </p>
            </div>
          </div>

          {fieldErrors.visitor && (
            <p id="resident-visitor-error" role="alert" className="text-xs text-destructive">
              {fieldErrors.visitor}
            </p>
          )}
          {fieldErrors.uses && (
            <p role="alert" className="text-xs text-destructive">
              {fieldErrors.uses}
            </p>
          )}

          <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Vigencia</h2>
              <div role="group" aria-label="Vigencia" className="flex flex-wrap gap-2">
                {DURATIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={duration === option.value ? 'default' : 'outline'}
                    aria-pressed={duration === option.value}
                    onClick={() => selectDuration(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {duration === 'range' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="resident-range-from">Desde</Label>
                  <Input
                    id="resident-range-from"
                    type="date"
                    value={rangeFrom}
                    onChange={(event) => {
                      setRangeFrom(event.target.value);
                      clearFieldError('window');
                    }}
                    aria-invalid={Boolean(fieldErrors.window)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="resident-range-until">Hasta</Label>
                  <Input
                    id="resident-range-until"
                    type="date"
                    value={rangeUntil}
                    onChange={(event) => {
                      setRangeUntil(event.target.value);
                      clearFieldError('window');
                    }}
                    aria-invalid={Boolean(fieldErrors.window)}
                  />
                </div>
              </div>
            )}

            {fieldErrors.window && (
              <p id="resident-window-error" role="alert" className="text-xs text-destructive">
                {fieldErrors.window}
              </p>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Duración</h2>
              <p className="text-xs text-muted-foreground">
                Horario en el que el pase permite entrar. Si lo dejás vacío, sirve a cualquier hora
                del día.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <TimeField
                id="resident-time-from"
                label="Hora inicio"
                value={effectiveImmediate ? '' : scheduleFrom}
                onChange={(next) => {
                  setScheduleFrom(next);
                  clearFieldError('schedule');
                }}
                invalid={Boolean(fieldErrors.schedule)}
                disabled={effectiveImmediate}
              />
              <TimeField
                id="resident-time-to"
                label="Hora final"
                value={scheduleTo}
                onChange={(next) => {
                  setScheduleTo(next);
                  clearFieldError('schedule');
                }}
                invalid={Boolean(fieldErrors.schedule)}
              />
            </div>

            {fieldErrors.schedule && (
              <p role="alert" className="text-xs text-destructive">
                {fieldErrors.schedule}
              </p>
            )}

            <div className="space-y-1 border-t border-border pt-3">
              <label
                className={cn(
                  'flex items-center gap-2 text-sm',
                  !immediateApplies && 'text-muted-foreground',
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={effectiveImmediate}
                  disabled={!immediateApplies}
                  onChange={(event) => toggleImmediateEntry(event.target.checked)}
                />
                Entrada inmediata
              </label>
              <p className="text-xs text-muted-foreground">
                {immediateApplies
                  ? effectiveImmediate
                    ? 'El pase vale desde el momento en que lo confirmás.'
                    : 'El pase no sirve antes de la hora de inicio.'
                  : 'Sólo aplica a la vigencia de hoy; en los otros modos manda la hora de inicio.'}
              </p>
            </div>
          </section>

          <fieldset
            disabled={!isRecurrent}
            className={cn(
              'space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4',
              !isRecurrent && 'opacity-60',
            )}
          >
            <legend className="px-1 text-sm font-semibold">Recurrente</legend>
            <p className="text-xs text-muted-foreground">
              {isRecurrent
                ? 'Elegí los días y, si querés, desde y hasta cuándo vale. Usa el horario de la tarjeta Duración.'
                : 'Elegí «Recurrente» en Vigencia para configurar los días.'}
            </p>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Días de la semana">
              {WEEKDAYS.map((day) => {
                const active = allowedDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    aria-label={day.name}
                    aria-pressed={active}
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      'size-9 rounded-full border text-sm font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted',
                    )}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
            {fieldErrors.days && (
              <p role="alert" className="text-xs text-destructive">
                {fieldErrors.days}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="resident-recurrence-from">Desde</Label>
                <Input
                  id="resident-recurrence-from"
                  type="date"
                  value={recurrenceFrom}
                  onChange={(event) => {
                    setRecurrenceFrom(event.target.value);
                    clearFieldError('recurrenceUntil');
                  }}
                  aria-invalid={Boolean(fieldErrors.recurrenceUntil)}
                />
                <p className="text-xs text-muted-foreground">Si lo dejás vacío, empieza hoy.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="resident-recurrence-until">Hasta</Label>
                <Input
                  id="resident-recurrence-until"
                  type="date"
                  value={recurrenceUntil}
                  onChange={(event) => {
                    setRecurrenceUntil(event.target.value);
                    clearFieldError('recurrenceUntil');
                  }}
                  aria-invalid={Boolean(fieldErrors.recurrenceUntil)}
                />
                <p className="text-xs text-muted-foreground">Si lo dejás vacío, no vence.</p>
              </div>
            </div>
            {fieldErrors.recurrenceUntil && (
              <p role="alert" className="text-xs text-destructive">
                {fieldErrors.recurrenceUntil}
              </p>
            )}
          </fieldset>

          <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={entryOnly}
                onChange={(event) => {
                  setEntryOnly(event.target.checked);
                  clearFieldError('uses');
                }}
              />
              Sólo entrada
            </label>
            <p className="text-xs text-muted-foreground">
              {entryOnly
                ? 'El pase se consume al entrar; no hace falta registrar el egreso.'
                : 'Permite entrada y salida. Un uso es un par de entrada y salida.'}
            </p>
          </div>

          <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={hasVehicle}
                onChange={(event) => setHasVehicle(event.target.checked)}
              />
              Ingresa en vehículo
            </label>
            {hasVehicle && (
              <div className="space-y-1">
                <Label htmlFor="resident-vehicle-plate">Placa</Label>
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
      return 'Esta unidad alcanzó el límite de autorizaciones por hoy. Prueba de nuevo mañana.';
    case 'recurring_not_available':
      return 'Ese tipo de autorización todavía no está disponible desde la web.';
    case 'rate_limited':
      return 'Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.';
    case 'dynamic_qr_disabled':
      return 'Las autorizaciones con QR están desactivadas en esta comunidad.';
    case 'invalid':
      return 'Revisa las fechas y el horario permitido.';
    default:
      if (err instanceof ApiError && err.message && !/^[a-z_]+$/.test(err.message)) {
        return err.message;
      }
      return 'No se pudo crear la autorización. Reintenta en unos segundos.';
  }
}
