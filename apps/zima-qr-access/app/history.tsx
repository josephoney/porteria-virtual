import type { PassStatus } from '@porteria/shared';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PassWithPath } from '@/api/passes';
import { useAuth } from '@/auth/AuthContext';
import { homeForRole, modeForRole } from '@/auth/roles';
import { Badge, Button, Card, EmptyState, LoadingView, Screen, ui } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { formatDate, presenceLabel, statusLabel } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';

type Filter = 'all' | PassStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'used', label: 'Usados' },
  { value: 'revoked', label: 'Revocados' },
  { value: 'expired', label: 'Expirados' },
];

function statusTone(status: PassStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'active':
      return 'success';
    case 'used':
      return 'info';
    case 'revoked':
      return 'danger';
    case 'expired':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function HistoryScreen() {
  const { session, request } = useAuth();
  const router = useRouter();
  const [passes, setPasses] = useState<PassWithPath[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`;
      const rows = await request<PassWithPath[]>(`/api/passes${query}`);
      setPasses(rows);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [request, filter]);

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

  return (
    <Screen>
      <Text style={ui.heading}>Historial de pases</Text>
      <View style={styles.filters}>
        {FILTERS.map((option) => {
          const selected = filter === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setFilter(option.value)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? <LoadingView message="Cargando historial…" /> : null}
      {error ? <Text style={ui.error}>{error}</Text> : null}

      {!loading && passes.length === 0 ? (
        <EmptyState
          title="Sin pases"
          message="Cuando crees pases van a aparecer acá con su estado."
          action={
            <Button label="Crear pase" variant="secondary" onPress={() => router.push('/create')} />
          }
        />
      ) : null}

      {!loading
        ? passes.map((pass) => (
            <Card key={pass.id} onPress={() => router.push(`/pass/${pass.id}`)}>
              <View style={styles.row}>
                <Text style={ui.sectionTitle}>
                  {pass.visitorFirstName} {pass.visitorLastName}
                </Text>
                <Badge label={statusLabel(pass.status)} tone={statusTone(pass.status)} />
              </View>
              <Text style={ui.muted}>{pass.locationPath}</Text>
              <Text style={ui.muted}>
                {formatDate(pass.validFrom)} · {presenceLabel(pass.presenceState)}
              </Text>
              {pass.vehiclePlate ? (
                <Text style={ui.muted}>Vehículo {pass.vehiclePlate}</Text>
              ) : null}
            </Card>
          ))
        : null}

      <Button label="Actualizar" variant="ghost" onPress={() => void load()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(109, 141, 255, 0.16)',
  },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipLabelSelected: {
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
