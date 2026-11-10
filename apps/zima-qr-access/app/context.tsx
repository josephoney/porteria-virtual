import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { homeForRole } from '@/auth/roles';
import { Button, Card, Screen, ui } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { roleLabel } from '@/lib/format';
import { colors, spacing } from '@/theme';

export default function ContextScreen() {
  const { pendingSelection, selectMembership, signOut } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (!pendingSelection) {
    return <Redirect href="/" />;
  }

  const onSelect = async (membershipId: string) => {
    setSubmittingId(membershipId);
    setError(null);
    try {
      const next = await selectMembership(membershipId);
      router.replace(homeForRole(next.activeMembership.role));
    } catch (selectError) {
      setError(errorMessage(selectError));
    } finally {
      setSubmittingId(null);
    }
  };

  const onUseAnotherAccount = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <Screen>
      <Text style={ui.heading}>Elegí con qué membresía entrar</Text>
      <Text style={ui.muted}>
        Tenés más de un contexto activo. La app va a usar el rol y la unidad de la membresía que
        elijas.
      </Text>

      {pendingSelection.memberships.map((membership) => (
        <Card key={membership.id} onPress={() => onSelect(membership.id)}>
          <Text style={ui.sectionTitle}>{roleLabel(membership.role)}</Text>
          <Text style={ui.muted}>
            {membership.communityId ? 'Comunidad asignada' : 'Sin comunidad'}
          </Text>
          {membership.locationUnitId ? <Text style={ui.muted}>Unidad asignada</Text> : null}
          {submittingId === membership.id ? <Text style={styles.submitting}>Entrando…</Text> : null}
        </Card>
      ))}

      {error ? <Text style={ui.error}>{error}</Text> : null}

      <Button
        label="Usar otra cuenta"
        variant="ghost"
        onPress={onUseAnotherAccount}
        disabled={submittingId !== null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  submitting: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
});
