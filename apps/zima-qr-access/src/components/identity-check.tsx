import { CameraView } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { isPermanentPass } from '@porteria/shared';

import {
  confirmIdentityEntry,
  denyIdentityEntry,
  searchAuthorizations,
  type IdentityCandidate,
} from '@/api/access';
import { Badge, Button, Divider, ui } from '@/components/ui';
import { documentFromBarcode } from '@/lib/cedula';
import { colors, radius, spacing, typography } from '@/theme';

type RequestFn = <T>(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
) => Promise<T>;

const formatWindow = (from: string, until: string) => {
  const format = (value: string) =>
    new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  if (isPermanentPass(until)) return `${format(from)} → sin fecha de fin`;
  return `${format(from)} → ${format(until)}`;
};

const ENTRY_ERRORS: Record<string, string> = {
  pass_used: 'Esa autorización ya fue usada.',
  conflict: 'Esa persona ya está registrada dentro o fuera, según el caso.',
  not_valid_now: 'La autorización no está vigente en este momento.',
  out_of_days: 'Hoy no es un día autorizado para esta persona.',
  out_of_schedule: 'Estamos fuera del horario permitido para esta autorización.',
  daily_uses_exhausted: 'Esta autorización ya agotó los usos permitidos para hoy.',
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
      setError('Escribe el número de cédula completo.');
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
          ? 'Hiciste muchas consultas seguidas. Espera un minuto y reintenta.'
          : code === 'no_active_shift'
            ? 'Necesitas un turno abierto para verificar autorizaciones.'
            : 'No se pudo verificar la cédula. Revisa la conexión y reintenta.',
      );
    } finally {
      setSearching(false);
    }
  }

  async function confirm(passId: string, action: 'entry' | 'exit') {
    setConfirmingId(passId);
    setError('');
    try {
      await confirmIdentityEntry(request, passId, action);
      setNotice('Ingreso registrado. Listo para el siguiente.');
      setCameraOpen(false);
      setCandidates(null);
      setDocument('');
      setManualOpen(false);
      onConfirmed();
    } catch (err) {
      const code = (err as { body?: { message?: string } })?.body?.message;
      setError(ENTRY_ERRORS[code ?? ''] ?? 'No se pudo registrar el ingreso. Reintenta.');
    } finally {
      setConfirmingId(null);
    }
  }

  async function deny(passId: string, reason: 'expired' | 'used' | 'denied') {
    setConfirmingId(passId);
    setError('');
    try {
      await denyIdentityEntry(request, passId, reason);
      setNotice('Acceso denegado y registrado. Listo para el siguiente.');
      setCandidates(null);
      setDocument('');
      setManualOpen(false);
      onConfirmed();
    } catch {
      setError('No se pudo registrar la denegación. Reintenta.');
    } finally {
      setConfirmingId(null);
    }
  }
  /**
   * The card payload is the whole registry record, not the document. It is parsed
   * and the number is shown in an editable field: the guard sees what will be
   * verified and can correct it if the card is damaged.
   */
  function onBarcodeScanned(result: { data: string }) {
    setCameraOpen(false);
    const extracted = documentFromBarcode(result.data);
    reset();
    setManualOpen(true);
    if (extracted) {
      setDocument(extracted);
    } else {
      setDocument('');
      setError('No se pudo leer el número en el código. Escríbelo a mano.');
    }
  }

  return (
    <View style={styles.wrapper}>
      <Divider />

      <Button
        label="Escanear cédula"
        variant="secondary"
        onPress={() => {
          reset();
          setCameraOpen((open) => !open);
        }}
        disabled={searching}
      />

      {cameraOpen ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['pdf417'] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <Button label="Cancelar" variant="ghost" onPress={() => setCameraOpen(false)} />
        </View>
      ) : null}

      {manualOpen ? (
        <Modal
          visible={manualOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setManualOpen(false)}
        >
          {/*
            La cédula se escribe en una hoja propia: así el campo y el botón
            quedan por encima del teclado numérico sin depender del scroll de la
            pantalla que hay detrás.
          */}
          <KeyboardAvoidingView
            style={styles.manualBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
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
                autoFocus
              />
              <Button
                label="Verificar autorización"
                onPress={() => void search(document)}
                loading={searching}
                disabled={searching || document.trim().length < 4}
              />
              <Button label="Cancelar" variant="ghost" onPress={() => setManualOpen(false)} />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      ) : (
        <Button
          label="Ingresar cédula"
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

      <Modal
        visible={Boolean(candidates && candidates.length > 0)}
        transparent
        animationType="fade"
        onRequestClose={() => setCandidates(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Pressable
              style={styles.modalClose}
              onPress={() => setCandidates(null)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Text style={styles.modalCloseText}>X</Text>
            </Pressable>
            {candidates?.map((candidate) => {
              const remaining = candidate.rule.remainingUses;
              const expired = new Date(candidate.validUntil).getTime() < Date.now();
              const consumed = remaining === 0 || candidate.status === 'used';
              // A pass with nothing left or past its window is only informative: the
              // guard sees it as used or expired and gets no action.
              const inside = candidate.presenceState === 'inside' && !consumed && !expired;
              const action: 'entry' | 'exit' = inside ? 'exit' : 'entry';
              const label = inside ? 'Registrar salida' : 'Confirmar ingreso';
              const usedLabel = candidate.rule.recurrence === 'once' ? 'Usado' : 'Sin usos hoy';
              return (
                <View key={candidate.passId} style={styles.candidate}>
                  <View style={styles.candidateHeader}>
                    <Text style={styles.candidateName}>
                      {candidate.visitorFirstName} {candidate.visitorLastName}
                    </Text>
                    <Badge
                      label={
                        expired ? 'Vencido' : consumed ? usedLabel : inside ? 'Dentro' : 'Activa'
                      }
                      tone={expired || consumed ? 'danger' : inside ? 'warning' : 'success'}
                    />
                  </View>
                  <Text style={ui.muted}>
                    {candidate.destinationPath || candidate.destinationName}
                  </Text>
                  <Text style={ui.muted}>
                    {formatWindow(candidate.validFrom, candidate.validUntil)}
                  </Text>
                  <Text style={ui.muted}>{candidate.rule.summary}</Text>
                  {candidate.companions?.length ? (
                    <View style={styles.companions}>
                      <Text style={styles.companionsTitle}>
                        {candidate.companions.length === 1
                          ? 'Acompañante'
                          : `Acompañantes (${candidate.companions.length})`}
                      </Text>
                      {candidate.companions.map((companion, index) => (
                        <Text key={`${companion.document}-${index}`} style={styles.companionLine}>
                          {companion.firstName} {companion.lastName} · Doc. {companion.document}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {consumed || expired ? (
                    <Button
                      label="Denegar"
                      variant="danger"
                      onPress={() =>
                        void deny(
                          candidate.passId,
                          expired
                            ? 'expired'
                            : candidate.rule.recurrence === 'once'
                              ? 'used'
                              : 'denied',
                        )
                      }
                      loading={confirmingId === candidate.passId}
                      disabled={confirmingId !== null}
                    />
                  ) : (
                    <View style={styles.actions}>
                      <Button
                        label={label}
                        onPress={() => void confirm(candidate.passId, action)}
                        loading={confirmingId === candidate.passId}
                        disabled={confirmingId !== null}
                      />
                      <Button
                        label="Denegar"
                        variant="danger"
                        onPress={() => void deny(candidate.passId, 'denied')}
                        disabled={confirmingId !== null}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  cameraBox: {
    gap: spacing.sm,
  },
  camera: {
    borderRadius: radius.lg,
    height: 260,
    overflow: 'hidden',
  },
  manualBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  manualBox: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  modalClose: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.sm,
  },
  modalCloseText: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '700',
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
  companions: {
    gap: 2,
    marginTop: spacing.xs,
  },
  companionsTitle: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  companionLine: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
});
