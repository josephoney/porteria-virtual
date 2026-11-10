import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PassWithPath } from '@/api/passes';
import { useAuth } from '@/auth/AuthContext';
import { homeForRole, modeForRole } from '@/auth/roles';
import { Badge, Button, Card, EmptyState, LoadingView, Screen, ui } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { formatDate, presenceLabel, roleLabel, statusLabel } from '@/lib/format';
import { colors, spacing } from '@/theme';

export default function ResidentHomeScreen() {
  const { session, request, signOut } = useAuth();
  const router = useRouter();
  const [passes, setPasses] = useState<PassWithPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await request<PassWithPath[]>('/api/passes?status=active');
      setPasses(rows);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!session) {
    return <Redirect href="/" />;
  }
  if (modeForRole(session.activeMembership.role) !== 'resident') {
    return <Redirect href={homeForRole(session.activeMembership.role)} />;
  }

  const unitAssigned = Boolean(session.activeMembership.locationUnitId);

  const onSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  if (loading) {
    return <LoadingView message="Cargando tus pases…" />;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={ui.title}>Hola, {session.user.name.split(' ')[0]}</Text>
          <Text style={ui.muted}>
            {roleLabel(session.activeMembership.role)} · {passes.length} pase
            {passes.length === 1 ? '' : 's'} activo{passes.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Badge label="Residente" tone="info" />
      </View>

      {!unitAssigned ? (
        <Card>
          <Text style={ui.sectionTitle}>Falta asignar tu unidad</Text>
          <Text style={ui.muted}>
            Tu membresía no tiene una unidad asociada. Pedile al administrador que la asigne para
            poder crear pases.
          </Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Crear pase"
          onPress={() => router.push('/create')}
          disabled={!unitAssigned}
        />
        <Button label="Historial" variant="secondary" onPress={() => router.push('/history')} />
      </View>

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Text style={ui.sectionTitle}>Pases activos</Text>

      {passes.length === 0 ? (
        <EmptyState
          title="No tenés pases activos"
          message="Creá un pase para que tu visita pueda ingresar mostrando un QR dinámico."
          action={
            <Button
              label="Crear mi primer pase"
              variant="secondary"
              onPress={() => router.push('/create')}
              disabled={!unitAssigned}
            />
          }
        />
      ) : (
        passes.map((pass) => (
          <Card key={pass.id} onPress={() => router.push(`/pass/${pass.id}`)}>
            <View style={styles.passHeader}>
              <Text style={ui.sectionTitle}>
                {pass.visitorFirstName} {pass.visitorLastName}
              </Text>
              <Badge label={statusLabel(pass.status)} tone="info" />
            </View>
            <Text style={ui.muted}>{pass.locationPath}</Text>
            <Text style={ui.muted}>
              Vence {formatDate(pass.validUntil)} · {presenceLabel(pass.presenceState)}
            </Text>
            {pass.vehiclePlate ? <Text style={ui.muted}>Vehículo {pass.vehiclePlate}</Text> : null}
          </Card>
        ))
      )}

      <Button label="Actualizar" variant="ghost" onPress={() => void load()} />
      <Button label="Cerrar sesión" variant="ghost" onPress={onSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  passHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
