import { Redirect, useRouter } from 'expo-router';
import { Text } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { homeForRole, modeForRole } from '@/auth/roles';
import { Button, Card, LoadingView, Screen, ui } from '@/components/ui';
import { roleLabel } from '@/lib/format';

export default function NoModeScreen() {
  const { session, loading, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return <LoadingView message="Restaurando sesión…" />;
  }
  if (!session) {
    return <Redirect href="/" />;
  }
  if (modeForRole(session.activeMembership.role) !== 'none') {
    return <Redirect href={homeForRole(session.activeMembership.role)} />;
  }

  const onSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <Screen>
      <Card>
        <Text style={ui.heading}>Usá el dashboard</Text>
        <Text style={ui.body}>
          Entraste como {roleLabel(session.activeMembership.role)}. La app móvil está pensada para
          residentes y guardias; la administración de la comunidad se hace desde el dashboard web.
        </Text>
      </Card>
      <Button label="Cerrar sesión" variant="secondary" onPress={onSignOut} />
    </Screen>
  );
}
