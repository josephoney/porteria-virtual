import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { homeForRole } from '@/auth/roles';
import { Button, Field, LoadingView, Screen, ui } from '@/components/ui';
import { ZimaLogo } from '@/components/zima-logo';
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
      setError('Completa email y contraseña.');
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/*
          El formulario scrollea y se adapta al teclado: cuando el gestor de
          contraseñas completa la cuenta, el botón de Ingresar sigue a la vista
          en vez de quedar debajo. `keyboardShouldPersistTaps` deja que el primer
          toque actúe aunque el teclado esté abierto.
        */}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <ZimaLogo />
            <Text style={ui.title}>QR Access</Text>
            <Text style={styles.subtitle}>Acceso a tu comunidad.</Text>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
    padding: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
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
