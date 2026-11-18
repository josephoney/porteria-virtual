import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { PERMANENT_PASS_UNTIL, isPermanentPass, type PassLinkResponse } from '@porteria/shared';
import { useAuth } from '@/auth/AuthContext';
import { homeForRole, modeForRole } from '@/auth/roles';
import { Button, Card, Field, Screen, ui } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { colors, radius, spacing, typography } from '@/theme';

type ValidityMode = 'today' | 'tomorrow' | 'range' | 'recurrent';
type Recurrence = 'once' | 'range' | 'weekly';
type PickerMode = 'date' | 'time';

interface UnitDestination {
  id: string;
  name: string;
  path?: string;
}

const VALIDITY_OPTIONS: Array<{ value: ValidityMode; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: 'tomorrow', label: 'Mañana' },
  { value: 'range', label: 'Varios días' },
  { value: 'recurrent', label: 'Recurrente' },
];

/** Monday first, as the resident reads a calendar. 0 is Sunday in the API. */
const WEEKDAYS: Array<{ value: number; short: string; name: string }> = [
  { value: 1, short: 'L', name: 'lunes' },
  { value: 2, short: 'M', name: 'martes' },
  { value: 3, short: 'X', name: 'miércoles' },
  { value: 4, short: 'J', name: 'jueves' },
  { value: 5, short: 'V', name: 'viernes' },
  { value: 6, short: 'S', name: 'sábado' },
  { value: 0, short: 'D', name: 'domingo' },
];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function atTime(day: Date, time: Date) {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0,
  );
}

function atClock(day: Date, hours: number, minutes: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
}

function formatDate(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTime(date: Date) {
  const hours = date.getHours();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${pad(date.getMinutes())} ${suffix}`;
}

function time24(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function daysLabel(days: number[]) {
  const names = WEEKDAYS.filter((day) => days.includes(day.value)).map((day) => day.name);
  if (names.length === 0) return 'Ningún día';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

interface DateTimeFieldProps {
  label: string;
  value: Date | null;
  mode: PickerMode;
  onChange: (date: Date) => void;
  onClear?: () => void;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
}

/**
 * Native picker. Android opens the platform dialog; iOS shows an inline
 * spinner in a sheet because the component does not dismiss itself there.
 */
function DateTimeField({
  label,
  value,
  mode,
  onChange,
  onClear,
  disabled,
  minimumDate,
  maximumDate,
  placeholder,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? new Date());

  function openPicker() {
    setDraft(value ?? new Date());
    setOpen(true);
  }

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selected) onChange(selected);
      return;
    }
    if (event.type === 'set' && selected) setDraft(selected);
  }

  const shown = value
    ? mode === 'date'
      ? formatDate(value)
      : formatTime(value)
    : (placeholder ?? (mode === 'date' ? 'Elegir fecha' : 'Elegir hora'));

  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {onClear && value ? (
          <Pressable onPress={onClear} hitSlop={8}>
            <Text style={ui.link}>Quitar</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        disabled={disabled}
        onPress={openPicker}
        style={[styles.input, disabled && styles.inputDisabled]}
      >
        <Text style={value ? styles.inputText : styles.inputPlaceholder}>{shown}</Text>
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode={mode}
          display="default"
          is24Hour={false}
          minimumDate={mode === 'date' ? minimumDate : undefined}
          maximumDate={mode === 'date' ? maximumDate : undefined}
          onChange={handleChange}
        />
      ) : null}

      {open && Platform.OS === 'ios' ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setOpen(false)}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
            <View style={styles.sheet}>
              <Text style={ui.sectionTitle}>{label}</Text>
              <DateTimePicker
                value={draft}
                mode={mode}
                display="spinner"
                is24Hour={false}
                minimumDate={mode === 'date' ? minimumDate : undefined}
                maximumDate={mode === 'date' ? maximumDate : undefined}
                themeVariant="dark"
                onChange={handleChange}
              />
              <Button
                label="Listo"
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchBody}>
        <Text style={styles.switchText}>{label}</Text>
        {hint ? <Text style={ui.muted}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.white}
      />
    </View>
  );
}

export default function CreatePassScreen() {
  const router = useRouter();
  const { session, request } = useAuth();

  // The session only carries the unit id. The readable path is fetched once so
  // the resident sees the actual unit instead of a UUID.
  const unitId = session?.activeMembership?.locationUnitId ?? null;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [document, setDocument] = useState('');
  const [hasVehicle, setHasVehicle] = useState(false);
  const [plate, setPlate] = useState('');
  const [pin, setPin] = useState('');

  const [mode, setMode] = useState<ValidityMode>('today');
  const [immediate, setImmediate] = useState(true);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [startTime, setStartTime] = useState<Date>(() => atClock(new Date(), 8, 0));
  const [endTime, setEndTime] = useState<Date>(() => atClock(new Date(), 18, 0));
  const [rangeFrom, setRangeFrom] = useState<Date>(() => startOfDay(new Date()));
  const [rangeUntil, setRangeUntil] = useState<Date>(() => startOfDay(addDays(new Date(), 1)));
  const [recurrenceFrom, setRecurrenceFrom] = useState<Date>(() => startOfDay(new Date()));
  const [recurrenceUntil, setRecurrenceUntil] = useState<Date | null>(null);
  const [allowedDays, setAllowedDays] = useState<number[]>([]);
  const [entryOnly, setEntryOnly] = useState(false);
  const [maxUses, setMaxUses] = useState('1');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unitLabel, setUnitLabel] = useState<string | null>(null);
  const [unitLoading, setUnitLoading] = useState(() => Boolean(unitId));

  useEffect(() => {
    if (!unitId) {
      setUnitLabel(null);
      setUnitLoading(false);
      return;
    }

    let cancelled = false;
    setUnitLoading(true);

    void (async () => {
      try {
        const destinations = await request<UnitDestination[]>('/api/passes/destinations');
        if (cancelled) return;
        const unit = destinations.find((destination) => destination.id === unitId);
        setUnitLabel(unit?.path || unit?.name || null);
      } catch {
        if (!cancelled) setUnitLabel(null);
      } finally {
        if (!cancelled) setUnitLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [request, unitId]);

  if (!session) return <Redirect href="/" />;
  if (modeForRole(session.activeMembership.role) !== 'resident') {
    return <Redirect href={homeForRole(session.activeMembership.role)} />;
  }

  const recurrence: Recurrence =
    mode === 'recurrent' ? 'weekly' : mode === 'range' ? 'range' : 'once';
  const isRecurrent = mode === 'recurrent';
  const effectiveImmediate = mode === 'today' && immediate;
  const usesValue = Number(maxUses);

  function selectMode(next: ValidityMode) {
    setMode(next);
    setImmediate(next === 'today');
    setError('');
  }

  function toggleDay(day: number) {
    setAllowedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
    setError('');
  }

  function validityStart(day: Date) {
    return hasSchedule ? atTime(day, startTime) : startOfDay(day);
  }

  function buildWindow(now: Date): { start: Date; end: Date } {
    if (mode === 'today') {
      return {
        start: effectiveImmediate ? now : validityStart(now),
        end: endOfDay(now),
      };
    }

    if (mode === 'tomorrow') {
      const tomorrow = addDays(now, 1);
      return { start: validityStart(tomorrow), end: endOfDay(tomorrow) };
    }

    if (mode === 'range') {
      return { start: validityStart(rangeFrom), end: endOfDay(rangeUntil) };
    }

    return {
      start: validityStart(recurrenceFrom),
      end: recurrenceUntil ? endOfDay(recurrenceUntil) : new Date(PERMANENT_PASS_UNTIL),
    };
  }

  function describeRule(now: Date) {
    const window = buildWindow(now);
    const range = `del ${formatDate(window.start)} al ${formatDate(window.end)}`;
    let when: string;

    if (recurrence === 'weekly') {
      when = isPermanentPass(window.end)
        ? `${daysLabel(allowedDays)} desde el ${formatDate(window.start)}`
        : `${daysLabel(allowedDays)} ${range}`;
    } else if (recurrence === 'range') {
      when = `Todos los días ${range}`;
    } else if (effectiveImmediate) {
      when = `Desde ahora hasta el ${formatDate(window.end)}`;
    } else {
      when = `Un solo uso ${range}`;
    }

    const hours = hasSchedule
      ? effectiveImmediate
        ? `desde la confirmación hasta ${formatTime(endTime)}`
        : `de ${formatTime(startTime)} a ${formatTime(endTime)}`
      : 'en cualquier horario';
    const uses = entryOnly
      ? 'sólo entrada'
      : recurrence === 'once'
        ? `${usesValue} ${usesValue === 1 ? 'uso' : 'usos'} en total`
        : `hasta ${usesValue} ${usesValue === 1 ? 'uso' : 'usos'} por día`;

    return `${when.charAt(0).toUpperCase()}${when.slice(1)}, ${hours} · ${uses}.`;
  }

  function validate(now: Date): string | null {
    if (!unitId) return 'Tu usuario no tiene una unidad asignada.';
    if (!firstName.trim() || !lastName.trim() || !document.trim()) {
      return 'Completa nombre, apellido y documento.';
    }

    if (mode === 'range' && startOfDay(rangeUntil).getTime() < startOfDay(rangeFrom).getTime()) {
      return 'La fecha de fin debe ser igual o posterior a la de inicio.';
    }

    if (isRecurrent) {
      if (allowedDays.length === 0) return 'Marca al menos un día de la semana.';
      if (
        recurrenceUntil &&
        startOfDay(recurrenceUntil).getTime() < startOfDay(recurrenceFrom).getTime()
      ) {
        return 'La fecha de fin de la recurrencia no puede ser anterior al inicio.';
      }
    }

    const window = buildWindow(now);
    if (window.end.getTime() <= window.start.getTime()) {
      return 'La vigencia debe terminar después de empezar.';
    }

    if (hasSchedule) {
      if (effectiveImmediate) {
        if (minutesOfDay(endTime) <= minutesOfDay(now)) {
          return 'La hora final debe ser posterior a la hora actual.';
        }
      } else if (minutesOfDay(startTime) >= minutesOfDay(endTime)) {
        return 'La hora de inicio debe ser anterior a la hora final.';
      }
    }

    if (hasVehicle && !plate.trim()) return 'Ingresa la placa del vehículo.';
    if (!entryOnly && (!Number.isInteger(usesValue) || usesValue < 1 || usesValue > 20)) {
      return 'Elegí entre 1 y 20 usos.';
    }
    if (pin && !/^\d{4}$/.test(pin)) return 'El PIN tiene que tener 4 dígitos.';

    return null;
  }

  async function onSubmit() {
    const now = new Date();
    const message = validate(now);
    if (message) {
      setError(message);
      return;
    }

    if (!unitId) {
      setError('Tu usuario no tiene una unidad asignada.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const window = buildWindow(now);
      const timeFrom = hasSchedule ? (effectiveImmediate ? time24(now) : time24(startTime)) : null;
      const timeTo = hasSchedule ? time24(endTime) : null;

      const result = await request<PassLinkResponse>('/api/passes', {
        method: 'POST',
        body: {
          locationUnitId: unitId,
          visitorFirstName: firstName.trim(),
          visitorLastName: lastName.trim(),
          visitorDocument: document.trim(),
          hasVehicle,
          vehiclePlate: hasVehicle ? plate.trim().toUpperCase() : null,
          type: entryOnly ? 'entry_only' : 'entry_exit',
          recurrence,
          ...(recurrence === 'weekly' ? { allowedDays } : {}),
          ...(timeFrom && timeTo ? { timeFrom, timeTo } : {}),
          ...(entryOnly ? {} : { maxUses: usesValue }),
          validFrom: window.start.toISOString(),
          validUntil: window.end.toISOString(),
          pin: pin || null,
        },
      });

      router.replace({
        pathname: '/pass/[id]',
        params: { id: result.pass.id, shareUrl: result.shareUrl },
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text style={ui.title}>Nueva autorización</Text>
      <Text style={ui.muted}>
        Elegí la vigencia, el horario y cuántas veces puede entrar el visitante.
      </Text>

      <Card>
        <Text style={ui.sectionTitle}>Unidad</Text>
        <Text style={ui.body}>
          {unitLoading ? 'Cargando unidad…' : (unitLabel ?? 'Unidad asignada')}
        </Text>
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Visitante</Text>
        <Field label="Nombre" value={firstName} onChangeText={setFirstName} placeholder="Nombre" />
        <Field
          label="Apellido"
          value={lastName}
          onChangeText={setLastName}
          placeholder="Apellido"
        />
        <Field
          label="Documento"
          value={document}
          onChangeText={setDocument}
          placeholder="Número de documento"
          autoCapitalize="none"
        />
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Vehículo</Text>
        <ToggleRow label="Ingresa en vehículo" value={hasVehicle} onValueChange={setHasVehicle} />
        {hasVehicle ? (
          <Field
            label="Placa"
            value={plate}
            onChangeText={setPlate}
            placeholder="ABC123"
            autoCapitalize="characters"
          />
        ) : null}
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Vigencia</Text>
        <View style={styles.segmentRow}>
          {VALIDITY_OPTIONS.map((option) => {
            const active = mode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => selectMode(option.value)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'range' ? (
          <>
            <DateTimeField
              label="Desde"
              value={rangeFrom}
              mode="date"
              minimumDate={startOfDay(new Date())}
              onChange={(date) => {
                const next = startOfDay(date);
                setRangeFrom(next);
                if (rangeUntil.getTime() < next.getTime()) setRangeUntil(next);
              }}
            />
            <DateTimeField
              label="Hasta"
              value={rangeUntil}
              mode="date"
              minimumDate={rangeFrom}
              onChange={(date) => setRangeUntil(startOfDay(date))}
            />
          </>
        ) : null}

        {isRecurrent ? (
          <View style={styles.recurrentBox}>
            <Text style={styles.fieldLabel}>Días permitidos</Text>
            <View style={styles.chipsRow}>
              {WEEKDAYS.map((day) => {
                const active = allowedDays.includes(day.value);
                return (
                  <Pressable
                    key={day.value}
                    accessibilityLabel={day.name}
                    accessibilityState={{ selected: active }}
                    onPress={() => toggleDay(day.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {day.short}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <DateTimeField
              label="Desde (opcional)"
              value={recurrenceFrom}
              mode="date"
              minimumDate={startOfDay(new Date())}
              onChange={(date) => {
                const next = startOfDay(date);
                setRecurrenceFrom(next);
                if (recurrenceUntil && recurrenceUntil.getTime() < next.getTime()) {
                  setRecurrenceUntil(next);
                }
              }}
            />
            <DateTimeField
              label="Hasta (opcional)"
              value={recurrenceUntil}
              mode="date"
              minimumDate={recurrenceFrom}
              onChange={(date) => setRecurrenceUntil(startOfDay(date))}
              onClear={() => setRecurrenceUntil(null)}
              placeholder="Sin vencimiento"
            />
            <Text style={ui.muted}>
              Usa el horario de la tarjeta Duración. Sin fecha de fin, la recurrencia no vence.
            </Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Duración</Text>
        {mode === 'today' ? (
          <ToggleRow
            label="Entrada inmediata"
            hint={
              immediate
                ? 'El pase empieza en el momento en que lo confirmás.'
                : 'Elegí abajo la hora de inicio.'
            }
            value={immediate}
            onValueChange={(value) => {
              setImmediate(value);
              if (!value) setHasSchedule(true);
              setError('');
            }}
          />
        ) : null}
        <ToggleRow
          label="Restringir horario"
          hint={
            mode === 'today' && !immediate
              ? 'Con una hora de inicio elegida, el horario queda activo.'
              : 'Apagado, el pase sirve a cualquier hora.'
          }
          value={hasSchedule}
          onValueChange={(value) => {
            setHasSchedule(value);
            setError('');
          }}
          disabled={mode === 'today' && !immediate}
        />
        {hasSchedule ? (
          <>
            <DateTimeField
              label="Hora inicio"
              value={effectiveImmediate ? new Date() : startTime}
              mode="time"
              onChange={setStartTime}
              disabled={effectiveImmediate}
            />
            {effectiveImmediate ? (
              <Text style={ui.muted}>Con entrada inmediata, el pase empieza ahora.</Text>
            ) : null}
            <DateTimeField label="Hora final" value={endTime} mode="time" onChange={setEndTime} />
          </>
        ) : null}
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Usos</Text>
        {entryOnly ? (
          <Text style={ui.body}>1 uso. El pase se consume al entrar.</Text>
        ) : (
          <Field
            label={recurrence === 'once' ? 'Usos permitidos' : 'Usos por día'}
            value={maxUses}
            onChangeText={setMaxUses}
            keyboardType="number-pad"
          />
        )}
        <Text style={ui.muted}>
          {entryOnly
            ? 'No hace falta registrar el egreso.'
            : recurrence === 'once'
              ? 'Se cuentan en total, sin importar el día.'
              : 'Se reinician cada día. 1 uso = entrada y salida.'}
        </Text>
        <ToggleRow
          label="Sólo entrada"
          hint="Desmarcado, el pase permite entrar y salir."
          value={entryOnly}
          onValueChange={setEntryOnly}
        />
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>PIN (opcional)</Text>
        <Field
          label="PIN de 4 dígitos"
          value={pin}
          onChangeText={setPin}
          placeholder="Solo si querés proteger el link"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
        />
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Resumen</Text>
        <Text style={ui.body}>{describeRule(new Date())}</Text>
      </Card>

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Button
        label="Crear y compartir"
        onPress={onSubmit}
        loading={submitting}
        disabled={!unitId}
      />
      <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '600',
  },
  input: {
    minHeight: 50,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputText: {
    color: colors.text,
    fontSize: typography.body,
  },
  inputPlaceholder: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchBody: {
    flex: 1,
    gap: 2,
  },
  switchText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  segment: {
    flexBasis: '48%',
    flexGrow: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.md,
  },
  segmentActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.white,
  },
  recurrentBox: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.white,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    gap: spacing.md,
    padding: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
