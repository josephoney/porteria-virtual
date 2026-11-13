import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthContext';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="context"
            options={{ title: 'Elige un contexto', headerBackVisible: false }}
          />
          <Stack.Screen name="no-mode" options={{ title: 'Zima QR Access' }} />
          <Stack.Screen name="home" options={{ title: 'Mis pases' }} />
          <Stack.Screen name="create" options={{ title: 'Nuevo pase' }} />
          <Stack.Screen name="history" options={{ title: 'Historial' }} />
          <Stack.Screen name="pass/[id]" options={{ title: 'Pase' }} />
          <Stack.Screen name="scan" options={{ title: 'Escanear' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
