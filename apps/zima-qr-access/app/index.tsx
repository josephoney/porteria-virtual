import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { homeForRole } from '@/auth/roles';
import { Button, Field, LoadingView, Screen, ui } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

export default function LoginScreen() {
  const { session, pendingSelection, loading, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <LoadingView message="Restaurando sesión…" />;
  }
  if (session) {
    return <Redirect href={homeForRole(session.activeMembership.role)} />;
  }
  if (pendingSelection) {
    return <Redirect href="/context" />;
  }

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Completá email y contraseña.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await signIn(email, password);
      if (result.kind === 'selection') {
        router.replace('/context');
        return;
      }
      router.replace(homeForRole(result.session.activeMembership.role));
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>Z</Text>
          </View>
          <Text style={ui.title}>Zima QR Access</Text>
          <Text style={styles.subtitle}>Pases de visita dinámicos para tu comunidad.</Text>
        </View>

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="residente@porteria.local"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />
          {error ? <Text style={ui.error}>{error}</Text> : null}
          <Button label="Ingresar" onPress={onSubmit} loading={submitting} />
          {__DEV__ ? (
            <Text style={styles.devHint}>Demo: residente@porteria.local · porteria123</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
    padding: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  form: {
    gap: spacing.md,
  },
  devHint: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    textAlign: 'center',
  },
});
