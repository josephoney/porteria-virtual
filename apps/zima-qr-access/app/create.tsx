import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { PassLinkResponse } from '@porteria/shared';

import { createPass } from '@/api/passes';
import { useAuth } from '@/auth/AuthContext';
import { homeForRole, modeForRole } from '@/auth/roles';
import { Button, Card, Field, Screen, ui } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { addHours, formatDateTimeInput, parseDateTimeInput } from '@/lib/datetime';
import { colors, radius, spacing } from '@/theme';

type PassTypeOption = 'entry_only' | 'entry_exit';

const PASS_TYPES: Array<{ value: PassTypeOption; title: string; description: string }> = [
  {
    value: 'entry_only',
    title: 'Solo entrada',
    description: 'El pase se consume cuando el visitante entra.',
  },
  {
    value: 'entry_exit',
    title: 'Entrada y salida',
    description: 'Permite un ingreso y una salida; después queda usado.',
  },
];

export default function CreatePassScreen() {
  const { session, request } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [document, setDocument] = useState('');
  const [hasVehicle, setHasVehicle] = useState(false);
  const [plate, setPlate] = useState('');
  const [type, setType] = useState<PassTypeOption>('entry_only');
  const [validFromText, setValidFromText] = useState(formatDateTimeInput(new Date()));
  const [validUntilText, setValidUntilText] = useState(
    formatDateTimeInput(addHours(new Date(), 4)),
  );
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!session) {
    return <Redirect href="/" />;
  }
  if (modeForRole(session.activeMembership.role) !== 'resident') {
    return <Redirect href={homeForRole(session.activeMembership.role)} />;
  }

  const unitId = session.activeMembership.locationUnitId;

  const onSubmit = async () => {
    setError(null);

    if (!unitId) {
      setError('Tu membresía no tiene una unidad asignada. Pedile al administrador que la asigne.');
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !document.trim()) {
      setError('Completá nombre, apellido y documento del visitante.');
      return;
    }

    const validFrom = parseDateTimeInput(validFromText);
    const validUntil = parseDateTimeInput(validUntilText);
    if (!validFrom || !validUntil) {
      setError('Usá el formato AAAA-MM-DD HH:mm para las fechas.');
      return;
    }
    if (validUntil <= validFrom) {
      setError('La fecha de fin tiene que ser posterior a la de inicio.');
      return;
    }
    if ((timeFrom && !timeTo) || (!timeFrom && timeTo)) {
      setError('Completá desde y hasta, o dejá la ventana diaria vacía.');
      return;
    }
    if (timeFrom && timeTo && timeFrom >= timeTo) {
      setError('El horario "desde" tiene que ser anterior al "hasta".');
      return;
    }
    if (hasVehicle && !plate.trim()) {
      setError('Ingresá la patente del vehículo.');
      return;
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      setError('El PIN tiene que tener 4 dígitos.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await request<PassLinkResponse>('/api/passes', {
        method: 'POST',
        body: {
          locationUnitId: unitId,
          visitorFirstName: firstName.trim(),
          visitorLastName: lastName.trim(),
          visitorDocument: document.trim(),
          hasVehicle,
          vehiclePlate: hasVehicle ? plate.trim().toUpperCase() : null,
          type,
          validFrom: validFrom.toISOString(),
          validUntil: validUntil.toISOString(),
          timeFrom: timeFrom || null,
          timeTo: timeTo || null,
          pin: pin || null,
        },
      });

      router.replace({
        pathname: '/pass/[id]',
        params: { id: result.pass.id, shareUrl: result.shareUrl },
      });
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={ui.sectionTitle}>Unidad</Text>
        <Text style={ui.muted}>
          {unitId
            ? 'Se usa la unidad asignada a tu membresía. La ubicación completa se muestra en el pase.'
            : 'Tu membresía no tiene una unidad asignada.'}
        </Text>
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Visitante</Text>
        <Field label="Nombre" value={firstName} onChangeText={setFirstName} placeholder="Ana" />
        <Field label="Apellido" value={lastName} onChangeText={setLastName} placeholder="Pérez" />
        <Field
          label="Documento"
          value={document}
          onChangeText={setDocument}
          placeholder="30123456"
          keyboardType="number-pad"
        />
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={ui.sectionTitle}>Vehículo</Text>
            <Text style={ui.muted}>Mostrá la patente al guardia.</Text>
          </View>
          <Switch
            value={hasVehicle}
            onValueChange={setHasVehicle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
        {hasVehicle ? (
          <Field
            label="Patente"
            value={plate}
            onChangeText={setPlate}
            placeholder="AB123CD"
            autoCapitalize="characters"
            maxLength={10}
          />
        ) : null}
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Tipo de pase</Text>
        {PASS_TYPES.map((option) => {
          const selected = type === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setType(option.value)}
              style={[styles.typeCard, selected && styles.typeCardSelected]}
            >
              <Text style={[styles.typeTitle, selected && styles.typeTitleSelected]}>
                {option.title}
              </Text>
              <Text style={ui.muted}>{option.description}</Text>
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Vigencia</Text>
        <Text style={ui.muted}>Formato: AAAA-MM-DD HH:mm</Text>
        <Field
          label="Desde"
          value={validFromText}
          onChangeText={setValidFromText}
          placeholder="2026-11-09 18:00"
        />
        <Field
          label="Hasta"
          value={validUntilText}
          onChangeText={setValidUntilText}
          placeholder="2026-11-09 22:00"
        />
      </Card>

      <Card>
        <Text style={ui.sectionTitle}>Opciones</Text>
        <Field
          label="Ventana diaria desde (opcional)"
          value={timeFrom}
          onChangeText={setTimeFrom}
          placeholder="08:00"
        />
        <Field
          label="Ventana diaria hasta (opcional)"
          value={timeTo}
          onChangeText={setTimeTo}
          placeholder="20:00"
        />
        <Field
          label="PIN de 4 dígitos (opcional)"
          value={pin}
          onChangeText={setPin}
          placeholder="1234"
          keyboardType="number-pad"
          maxLength={4}
          secureTextEntry
          autoCapitalize="none"
        />
      </Card>

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Button label="Crear pase" onPress={onSubmit} loading={submitting} disabled={!unitId} />
      <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchText: {
    flex: 1,
    gap: spacing.xs,
  },
  typeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  typeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(109, 141, 255, 0.12)',
  },
  typeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  typeTitleSelected: {
    color: colors.primary,
  },
});
