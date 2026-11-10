import type { PassQrResponse, PassStatus } from '@porteria/shared';
import * as Clipboard from 'expo-clipboard';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { PassWithPath } from '@/api/passes';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { homeForRole, modeForRole } from '@/auth/roles';
import { Badge, Button, Card, LoadingView, Screen, ui } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatValidity, presenceLabel, statusLabel } from '@/lib/format';
import { colors, spacing } from '@/theme';

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

function finalMessage(status: PassStatus): string {
  switch (status) {
    case 'used':
      return 'Este pase ya fue utilizado.';
    case 'revoked':
      return 'Este pase fue revocado.';
    case 'expired':
      return 'Este pase expiró.';
    default:
      return '';
  }
}

export default function PassDetailScreen() {
  const { session, request } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    shareUrl?: string | string[];
  }>();

  const passId = Array.isArray(params.id) ? params.id[0] : params.id;
  const initialShareUrl = Array.isArray(params.shareUrl) ? params.shareUrl[0] : params.shareUrl;

  const [pass, setPass] = useState<PassWithPath | null>(null);
  const [qr, setQr] = useState<PassQrResponse | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(initialShareUrl ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const loadPass = useCallback(async () => {
    if (!passId) return;
    try {
      const row = await request<PassWithPath>(`/api/passes/${passId}`);
      setPass(row);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [request, passId]);

  useEffect(() => {
    void loadPass();
  }, [loadPass]);

  const isActive = pass?.status === 'active';

  const loadQr = useCallback(async () => {
    if (!passId || !isActive) return;
    try {
      const next = await request<PassQrResponse>(`/api/passes/${passId}/qr`);
      setQr(next);
      setQrError(null);
      setSeconds(Math.max(0, Math.ceil((new Date(next.expiresAt).getTime() - Date.now()) / 1000)));
    } catch (loadError) {
      if (loadError instanceof ApiError && (loadError.status === 409 || loadError.status === 410)) {
        await loadPass();
        return;
      }
      setQrError(errorMessage(loadError));
    }
  }, [request, passId, isActive, loadPass]);

  useEffect(() => {
    if (!isActive) {
      setQr(null);
      return;
    }

    void loadQr();
    const timer = setInterval(() => {
      void loadQr();
    }, 20_000);
    return () => clearInterval(timer);
  }, [isActive, loadQr]);

  useEffect(() => {
    if (!qr) return;
    const timer = setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((new Date(qr.expiresAt).getTime() - Date.now()) / 1000)));
    }, 1_000);
    return () => clearInterval(timer);
  }, [qr]);

  if (!session) {
    return <Redirect href="/" />;
  }
  if (modeForRole(session.activeMembership.role) !== 'resident') {
    return <Redirect href={homeForRole(session.activeMembership.role)} />;
  }

  if (loading) {
    return <LoadingView message="Cargando pase…" />;
  }

  if (!pass) {
    return (
      <Screen>
        <Card>
          <Text style={ui.heading}>No pudimos cargar el pase</Text>
          <Text style={ui.muted}>{error ?? 'Intentá de nuevo.'}</Text>
        </Card>
        <Button label="Reintentar" onPress={() => void loadPass()} />
        <Button label="Volver" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const regenerate = async (): Promise<string> => {
    const result = await request<{ shareUrl: string; linkExpiresAt: string }>(
      `/api/passes/${passId}/regenerate-link`,
      { method: 'POST' },
    );
    setShareUrl(result.shareUrl);
    return result.shareUrl;
  };

  const confirmRegenerate = () =>
    new Promise<string | null>((resolve) => {
      Alert.alert(
        'Generar link para compartir',
        'El link anterior dejará de funcionar. ¿Continuar?',
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
          {
            text: 'Generar',
            onPress: () => {
              void (async () => {
                try {
                  resolve(await regenerate());
                } catch (regenerateError) {
                  Alert.alert('Error', errorMessage(regenerateError));
                  resolve(null);
                }
              })();
            },
          },
        ],
      );
    });

  const ensureShareUrl = async (): Promise<string | null> => {
    if (shareUrl) return shareUrl;
    return confirmRegenerate();
  };

  const onShare = async () => {
    const url = await ensureShareUrl();
    if (!url) return;

    await Share.share({
      message: `${pass.visitorFirstName} ${pass.visitorLastName} tiene un pase para ${pass.locationPath}. Abrí el link: ${url}`,
    });
  };

  const onCopy = async () => {
    const url = await ensureShareUrl();
    if (!url) return;
    await Clipboard.setStringAsync(url);
    Alert.alert('Link copiado', 'Ya podés pegarlo en WhatsApp o donde quieras.');
  };

  const onRevoke = () => {
    Alert.alert('Revocar pase', 'El visitante ya no podrá ingresar. ¿Confirmás?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revocar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setActing(true);
            try {
              await request(`/api/passes/${passId}/revoke`, { method: 'POST' });
              await loadPass();
              setQr(null);
            } catch (revokeError) {
              Alert.alert('Error', errorMessage(revokeError));
            } finally {
              setActing(false);
            }
          })();
        },
      },
    ]);
  };

  const onRegenerate = () => {
    Alert.alert(
      'Regenerar link',
      'El link anterior dejará de funcionar y el dispositivo vinculado se libera. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Regenerar',
          onPress: () => {
            void (async () => {
              setActing(true);
              try {
                await regenerate();
                Alert.alert('Link regenerado', 'Ya podés compartir el nuevo link.');
              } catch (regenerateError) {
                Alert.alert('Error', errorMessage(regenerateError));
              } finally {
                setActing(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Card>
        <View style={styles.header}>
          <Text style={ui.heading}>
            {pass.visitorFirstName} {pass.visitorLastName}
          </Text>
          <Badge label={statusLabel(pass.status)} tone={statusTone(pass.status)} />
        </View>
        <Text style={ui.muted}>Documento {pass.visitorDocument}</Text>
        <Text style={ui.muted}>{pass.locationPath}</Text>
        <View style={styles.badges}>
          <Badge
            label={presenceLabel(pass.presenceState)}
            tone={pass.presenceState === 'inside' ? 'warning' : 'neutral'}
          />
          <Badge
            label={pass.type === 'entry_only' ? 'Solo entrada' : 'Entrada y salida'}
            tone="info"
          />
        </View>
        <Text style={ui.muted}>{formatValidity(pass.validFrom, pass.validUntil)}</Text>
        {pass.timeFrom && pass.timeTo ? (
          <Text style={ui.muted}>
            Horario diario {pass.timeFrom.slice(0, 5)}–{pass.timeTo.slice(0, 5)}
          </Text>
        ) : null}
        {pass.vehiclePlate ? <Text style={ui.muted}>Vehículo {pass.vehiclePlate}</Text> : null}
        <Text style={ui.muted}>Link válido hasta {formatDateTime(pass.linkExpiresAt)}</Text>
      </Card>

      {isActive ? (
        <Card>
          {qr ? (
            <>
              <View style={styles.qrBox}>
                <QRCode
                  value={qr.token}
                  size={236}
                  backgroundColor={colors.white}
                  color={colors.black}
                  quietZone={8}
                />
              </View>
              <Text style={styles.qrHint}>Se actualiza en {seconds}s</Text>
              <Text style={ui.muted}>
                Mostrá este QR al guardia. Se renueva solo; no compartas una captura.
              </Text>
            </>
          ) : (
            <Text style={ui.muted}>Generando QR…</Text>
          )}
          {qrError ? <Text style={ui.error}>{qrError}</Text> : null}
          {qrError ? (
            <Button label="Reintentar QR" variant="secondary" onPress={() => void loadQr()} />
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text style={ui.sectionTitle}>{finalMessage(pass.status)}</Text>
          <Text style={ui.muted}>
            {pass.presenceState === 'inside'
              ? 'El visitante figura dentro de la comunidad.'
              : 'El pase ya no está activo.'}
          </Text>
        </Card>
      )}

      {isActive ? (
        <>
          <Button label="Compartir link" onPress={() => void onShare()} disabled={acting} />
          <Button
            label="Copiar link"
            variant="secondary"
            onPress={() => void onCopy()}
            disabled={acting}
          />
          <Button label="Revocar pase" variant="danger" onPress={onRevoke} loading={acting} />
        </>
      ) : null}

      <Button label="Regenerar link" variant="ghost" onPress={onRegenerate} disabled={acting} />
      <Button label="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginVertical: spacing.xs,
  },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: 16,
    marginVertical: spacing.sm,
  },
  qrHint: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
