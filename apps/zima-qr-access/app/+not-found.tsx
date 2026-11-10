import { Link } from 'expo-router';
import { Text } from 'react-native';

import { Screen, ui } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <Screen>
      <Text style={ui.heading}>Pantalla no encontrada</Text>
      <Text style={ui.muted}>La ruta que abriste no existe en Zima QR Access.</Text>
      <Link href="/" style={ui.link}>
        Volver al inicio
      </Link>
    </Screen>
  );
}
