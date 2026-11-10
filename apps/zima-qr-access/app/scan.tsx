import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type {
  AccessPoint,
  GuardShiftCurrentResponse,
  GuardShiftHistoryItem,
  ScanDecisionResponse,
  ScanPassResponse,
} from '@porteria/shared';

import { confirmScan, rejectScan, scanPass } from '@/api/access';
import {
  changeAccessPoint,
  endShift,
  getCurrentShift,
  listAccessPoints,
  listShifts,
  startShift,
} from '@/api/shifts';
import { useAuth } from '@/auth/AuthContext';
import { homeForRole, modeForRole } from '@/auth/roles';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  LoadingView,
  Row,
  Screen,
  ui,
} from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, roleLabel } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';

function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${total} s`;
}

function actionLabel(action: string | null): string {
  if (action === 'entry') return 'Ingreso';
  if (action === 'exit') return 'Egreso';
  return 'Acción';
}

function reasonLabel(reason: string | null): string {
  switch (reason) {
    case 'pass_used':
      return 'El pase ya fue utilizado.';
    case 'revoked':
      return 'El pase fue revocado.';
    case 'expired':
      return 'El pase está expirado.';
    case 'out_of_schedule':
      return 'El pase está fuera del horario permitido.';
    case 'wrong_direction':
      return 'El sentido del escaneo no coincide con este acceso.';
    case 'token_already_used':
      return 'Ese QR ya fue usado.';
    default:
      return reason ?? 'Escaneo denegado.';
  }
}

export default function GuardScanScreen() {
  const { session, request, signOut } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [current, setCurrent] = useState<GuardShiftCurrentResponse | null>(null);
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [history, setHistory] = useState<GuardShiftHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'change'>('idle');
  const [manualToken, setManualToken] = useState('');
  const [scanResult, setScanResult] = useState<ScanPassResponse | null>(null);
  const [decision, setDecision] = useState<ScanDecisionResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const communityId = session.activeMembership.communityId;
      const [shift, points, shifts] = await Promise.all([
        getCurrentShift(request),
        communityId
          ? listAccessPoints(request, communityId)
          : Promise.resolve({ items: [] as AccessPoint[] }),
        listShifts(request, { page: 1, pageSize: 10 }),
      ]);
      setCurrent(shift);
      setAccessPoints(points.items);
      setHistory(shifts.items);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [request, session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!session) {
    return <Redirect href="/" />;
  }
  if (modeForRole(session.activeMembership.role) !== 'guard') {
    return <Redirect href={homeForRole(session.activeMembership.role)} />;
  }

  const communityId = session.activeMembership.communityId;
  const defaultAccessPoint = accessPoints.find(
    (point) => point.id === session.activeMembership.defaultAccessPointId,
  );
  const activeShift = current?.shift ?? null;
  const currentAccessPoint = current?.accessPoint ?? null;

  const refresh = useCallback(async () => {
    try {
      const [shift, shifts] = await Promise.all([
        getCurrentShift(request),
        listShifts(request, { page: 1, pageSize: 10 }),
      ]);
      setCurrent(shift);
      setHistory(shifts.items);
      setError(null);
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [request]);

  const onStart = async (accessPointId?: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await startShift(request, accessPointId ? { accessPointId } : {});
      setCurrent(next);
      setMode('idle');
      await refresh();
    } catch (startError) {
      setError(errorMessage(startError));
    } finally {
      setBusy(false);
    }
  };

  const onChange = async (accessPointId: string) => {
    if (!activeShift) return;
    setBusy(true);
    setError(null);
    try {
      const next = await changeAccessPoint(request, activeShift.id, {
        accessPointId,
      });
      setCurrent(next);
      setMode('idle');
      await refresh();
    } catch (changeError) {
      setError(errorMessage(changeError));
    } finally {
      setBusy(false);
    }
  };

  const onEnd = () => {
    if (!activeShift) return;
    Alert.alert('Cerrar turno', '¿Confirmás el cierre del turno?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar turno',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              const next = await endShift(request, activeShift.id);
              setCurrent(next);
              setMode('idle');
              await refresh();
            } catch (endError) {
              setError(errorMessage(endError));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const resetScan = () => {
    setScanResult(null);
    setDecision(null);
    setScanError(null);
    setScanned(false);
    setManualToken('');
  };

  const runScan = async (qrToken: string) => {
    const value = qrToken.trim();
    if (!value) return;
    setBusy(true);
    setScanError(null);
    setDecision(null);
    setScanResult(null);
    setScanned(true);
    try {
      const result = await scanPass(request, value);
      setScanResult(result);
      setManualToken('');
    } catch (scanFailure) {
      setScanError(errorMessage(scanFailure));
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (!scanResult?.scanId) return;
    setBusy(true);
    setScanError(null);
    try {
      const result = await confirmScan(request, scanResult.scanId);
      setDecision(result);
      await refresh();
    } catch (confirmError) {
      setScanError(errorMessage(confirmError));
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    if (!scanResult?.scanId) return;
    setBusy(true);
    setScanError(null);
    try {
      const result = await rejectScan(request, scanResult.scanId);
      setDecision(result);
      await refresh();
    } catch (rejectError) {
      setScanError(errorMessage(rejectError));
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  if (loading) {
    return <LoadingView message="Cargando turno…" />;
  }

  return (
    <Screen>
      <Card>
        <Text style={ui.heading}>{session.user.name}</Text>
        <Text style={ui.muted}>{session.user.email}</Text>
        <Text style={ui.muted}>Rol: {roleLabel(session.activeMembership.role)}</Text>
        {defaultAccessPoint ? (
          <Text style={ui.muted}>Acceso asignado: {defaultAccessPoint.name}</Text>
        ) : null}
      </Card>

      {error ? (
        <Card>
          <Text style={ui.error}>{error}</Text>
          <Button label="Reintentar" variant="secondary" onPress={() => void load()} />
        </Card>
      ) : null}

      {!activeShift ? (
        <Card>
          <Text style={ui.sectionTitle}>Iniciar turno</Text>
          <Text style={ui.muted}>Elegí el punto de acceso donde vas a cubrir el turno.</Text>
          {!communityId ? (
            <Text style={ui.error}>Tu usuario no tiene una comunidad asignada.</Text>
          ) : null}
          {accessPoints.length === 0 ? (
            <EmptyState
              title="Sin accesos activos"
              message="El administrador todavía no configuró porterías para esta comunidad."
            />
          ) : null}
          {accessPoints.map((point) => (
            <Card key={point.id} onPress={() => void onStart(point.id)}>
              <Row>
                <Text style={ui.body}>{point.name}</Text>
                {point.id === session.activeMembership.defaultAccessPointId ? (
                  <Badge label="Asignado" tone="info" />
                ) : null}
              </Row>
              <Text style={ui.muted}>
                {point.type} · {point.direction}
              </Text>
            </Card>
          ))}
        </Card>
      ) : (
        <>
          <Card>
            <Row>
              <Text style={ui.sectionTitle}>Turno en curso</Text>
              {current?.stale ? <Badge label="Turno largo" tone="warning" /> : null}
            </Row>
            <Text style={ui.heading}>{currentAccessPoint?.name ?? 'Sin acceso'}</Text>
            <Text style={ui.muted}>
              Inicio: {activeShift.startedAt ? formatDateTime(activeShift.startedAt) : '—'}
            </Text>
            <Text style={ui.muted}>Duración: {formatElapsed(current?.elapsedSeconds ?? 0)}</Text>
            <Row>
              <Button
                label="Cambiar acceso"
                variant="secondary"
                onPress={() => setMode(mode === 'change' ? 'idle' : 'change')}
                disabled={busy}
              />
              <Button label="Cerrar turno" variant="danger" onPress={onEnd} disabled={busy} />
            </Row>
          </Card>

          {mode === 'change' ? (
            <Card>
              <Text style={ui.sectionTitle}>Cambiar de acceso</Text>
              {accessPoints
                .filter((point) => point.id !== currentAccessPoint?.id)
                .map((point) => (
                  <Card key={point.id} onPress={() => void onChange(point.id)}>
                    <Text style={ui.body}>{point.name}</Text>
                    <Text style={ui.muted}>
                      {point.type} · {point.direction}
                    </Text>
                  </Card>
                ))}
              <Button label="Cancelar" variant="ghost" onPress={() => setMode('idle')} />
            </Card>
          ) : null}

          <Card>
            <Text style={ui.sectionTitle}>Escanear QR</Text>
            {!permission?.granted ? (
              <>
                <Text style={ui.muted}>
                  Necesitamos permiso de cámara para escanear el QR del visitante.
                </Text>
                <Button label="Permitir cámara" onPress={() => void requestPermission()} />
              </>
            ) : scanned ? (
              <Text style={ui.muted}>Escaneo listo. Revisá el resultado debajo.</Text>
            ) : (
              <View style={styles.cameraWrap}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => {
                    if (!scanned && !busy) {
                      setScanned(true);
                      void runScan(data);
                    }
                  }}
                />
              </View>
            )}
            <Divider />
            <Field
              label="O ingresá el token manualmente"
              value={manualToken}
              onChangeText={setManualToken}
              autoCapitalize="none"
              placeholder="Token del QR"
            />
            <Button
              label="Escanear token"
              onPress={() => void runScan(manualToken)}
              loading={busy}
              disabled={busy || !manualToken.trim()}
            />
          </Card>

          {scanError ? (
            <Card>
              <Text style={ui.error}>{scanError}</Text>
              <Button label="Escanear otro" variant="secondary" onPress={resetScan} />
            </Card>
          ) : null}

          {scanResult ? (
            <Card>
              <Row>
                <Badge
                  label={scanResult.authorized ? 'Autorizado' : 'Denegado'}
                  tone={scanResult.authorized ? 'success' : 'danger'}
                />
                <Badge label={actionLabel(scanResult.action)} tone="info" />
              </Row>
              <Text style={ui.heading}>
                {scanResult.visitor.firstName} {scanResult.visitor.lastName}
              </Text>
              <Text style={ui.muted}>Documento: {scanResult.visitor.document}</Text>
              {scanResult.vehiclePlate ? (
                <Text style={ui.muted}>Vehículo: {scanResult.vehiclePlate}</Text>
              ) : null}
              <Text style={ui.muted}>Ubicación: {scanResult.locationPath}</Text>
              <Text style={ui.muted}>Acceso: {scanResult.accessPointName}</Text>
              <Text style={ui.muted}>Autoriza: {scanResult.authorizedByName}</Text>
              <Text style={ui.muted}>
                Vigencia: {formatDateTime(scanResult.schedule.validFrom)} →{' '}
                {formatDateTime(scanResult.schedule.validUntil)}
              </Text>
              {scanResult.reason ? (
                <Text style={ui.error}>{reasonLabel(scanResult.reason)}</Text>
              ) : null}

              {scanResult.authorized && scanResult.scanId && !decision ? (
                <Row>
                  <Button label="Confirmar" onPress={() => void onConfirm()} loading={busy} />
                  <Button
                    label="Rechazar"
                    variant="danger"
                    onPress={() => void onReject()}
                    loading={busy}
                  />
                </Row>
              ) : null}

              {decision ? (
                <Text style={ui.body}>
                  {decision.status === 'confirmed'
                    ? 'Acceso confirmado. La bitácora quedó actualizada.'
                    : 'Acceso rechazado. La bitácora quedó actualizada.'}
                </Text>
              ) : null}

              <Button label="Escanear otro" variant="secondary" onPress={resetScan} />
            </Card>
          ) : null}
        </>
      )}

      <Card>
        <Text style={ui.sectionTitle}>Mis turnos</Text>
        {history.length === 0 ? (
          <Text style={ui.muted}>Todavía no hay turnos registrados.</Text>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <Row>
                <Text style={ui.body}>{item.accessPointName ?? 'Sin acceso'}</Text>
                <Badge
                  label={item.status === 'open' ? 'Abierto' : 'Cerrado'}
                  tone={item.status === 'open' ? 'success' : 'neutral'}
                />
              </Row>
              <Text style={ui.muted}>
                {formatDateTime(item.startedAt)} · {formatElapsed(item.durationSeconds)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Button label="Cerrar sesión" variant="secondary" onPress={() => void onSignOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
  },
  camera: {
    height: 260,
    width: '100%',
  },
  historyRow: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
