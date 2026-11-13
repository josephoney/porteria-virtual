import { CameraView } from 'expo-camera';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { confirmIdentityEntry, searchAuthorizations, type IdentityCandidate } from '@/api/access';
import { Badge, Button, Divider, ui } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

type RequestFn = <T>(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
) => Promise<T>;

const formatWindow = (from: string, until: string) => {
  const format = (value: string) =>
    new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  return `${format(from)} → ${format(until)}`;
};

/**
 * Second way in, for a visitor who cannot show the QR: the guard scans the ID
 * card or types its number, and the app lists the authorizations registered for
 * that document so the guard can confirm one.
 *
 * The document only finds candidates. Confirming is a decision the guard makes
 * while looking at the physical card.
 */
export function IdentityCheck({
  request,
  onConfirmed,
}: {
  request: RequestFn;
  onConfirmed: () => void;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [document, setDocument] = useState('');
  const [candidates, setCandidates] = useState<IdentityCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function reset() {
    setCandidates(null);
    setError('');
    setNotice('');
  }

  async function search(value: string) {
    const clean = value.trim();
    if (clean.length < 4) {
      setError('Escribí el número de cédula completo.');
      return;
    }

    reset();
    setSearching(true);
    try {
      const result = await searchAuthorizations(request, clean);
      setCandidates(result);
      if (result.length === 0) {
        setError('No hay autorizaciones vigentes para ese documento.');
      }
    } catch (err) {
      const code = (err as { body?: { message?: string } })?.body?.message;
      setError(
        code === 'rate_limited'
          ? 'Hiciste muchas consultas seguidas. Esperá un minuto y reintentá.'
          : code === 'no_active_shift'
            ? 'Necesitás un turno abierto para verificar autorizaciones.'
            : 'No se pudo verificar la cédula. Revisá la conexión y reintentá.',
      );
    } finally {
      setSearching(false);
    }
  }

  async function confirm(passId: string) {
    setConfirmingId(passId);
    setError('');
    try {
      await confirmIdentityEntry(request, passId);
      setNotice('Ingreso registrado.');
      setCandidates(null);
      setDocument('');
      setManualOpen(false);
      onConfirmed();
    } catch (err) {
      const code = (err as { body?: { message?: string } })?.body?.message;
      setError(
        code === 'pass_used'
          ? 'Esa autorización ya fue usada.'
          : code === 'not_valid_now'
            ? 'La autorización no está vigente en este momento.'
            : 'No se pudo registrar el ingreso. Reintentá.',
      );
    } finally {
      setConfirmingId(null);
    }
  }

  function onBarcodeScanned(result: { data: string }) {
    setCameraOpen(false);
    const value = result.data.replace(/[^0-9a-zA-Z]/g, '');
    setDocument(value);
    void search(value);
  }

  return (
    <View style={styles.wrapper}>
      <Divider />

      <View style={styles.actions}>
        <Button
          label="Escanear cédula"
          variant="secondary"
          onPress={() => {
            reset();
            setCameraOpen((open) => !open);
          }}
          disabled={searching}
        />
      </View>

      {cameraOpen && (
        <View style={styles.cameraBox}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['pdf417'] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <Button label="Cancelar" variant="ghost" onPress={() => setCameraOpen(false)} />
        </View>
      )}

      {manualOpen ? (
        <View style={styles.manualBox}>
          <Text style={ui.body}>Número de cédula</Text>
          <TextInput
            style={styles.input}
            value={document}
            onChangeText={setDocument}
            keyboardType="number-pad"
            placeholder="Ej. 1020304050"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            label="Verificar autorización"
            onPress={() => void search(document)}
            loading={searching}
            disabled={searching || document.trim().length < 4}
          />
        </View>
      ) : (
        <Button
          label="Ingresar cédula manualmente"
          variant="ghost"
          onPress={() => {
            reset();
            setManualOpen(true);
          }}
          disabled={searching}
        />
      )}

      {error ? <Text style={ui.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {candidates?.map((candidate) => {
        const used = candidate.status === 'used' || candidate.presenceState === 'inside';
        return (
          <View key={candidate.passId} style={styles.candidate}>
            <View style={styles.candidateHeader}>
              <Text style={styles.candidateName}>
                {candidate.visitorFirstName} {candidate.visitorLastName}
              </Text>
              <Badge label={used ? 'Usada' : 'Activa'} tone={used ? 'warning' : 'success'} />
            </View>
            <Text style={ui.muted}>{candidate.destinationPath || candidate.destinationName}</Text>
            <Text style={ui.muted}>{formatWindow(candidate.validFrom, candidate.validUntil)}</Text>
            <Button
              label={used ? 'Ya ingresó' : 'Confirmar ingreso'}
              onPress={() => void confirm(candidate.passId)}
              loading={confirmingId === candidate.passId}
              disabled={used || confirmingId !== null}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cameraBox: {
    gap: spacing.sm,
  },
  camera: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  manualBox: {
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  notice: {
    color: colors.success,
    fontSize: typography.small,
  },
  candidate: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  candidateHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  candidateName: {
    color: colors.text,
    flexShrink: 1,
    fontSize: typography.heading,
    fontWeight: '600',
  },
});
