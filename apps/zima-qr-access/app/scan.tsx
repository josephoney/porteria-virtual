import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  isPermanentPass,
  type AccessPoint,
  type BitacoraEntryDto,
  type GuardShiftCurrentResponse,
  type GuardShiftHistoryItem,
  type ScanDecisionResponse,
  type ScanPassResponse,
} from '@porteria/shared';

import { confirmScan, rejectScan, scanPass } from '@/api/access';
import { listBitacora } from '@/api/bitacora';
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
  CollapsibleSection,
  Divider,
  EmptyState,
  Field,
  LoadingView,
  Row,
  Screen,
  ui,
} from '@/components/ui';
import { IdentityCheck } from '@/components/identity-check';
import { DetailRow, DetailTable } from '@/components/detail-table';
import { ZimaLogo } from '@/components/zima-logo';
import { reasonText, toActivityItem } from '@/lib/bitacora';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatTime, roleLabel } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme';

function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${total} s`;
}

// La previsualización describe lo que el pase hará ahora, así que va en
// presente. El pasado queda para la bitácora y el historial.
function actionLabel(action: string | null): string {
  if (action === 'entry') return 'Ingreso';
  if (action === 'exit') return 'Salida';
  return 'Acción';
}

export default function GuardScanScreen() {
  const { session, request, signOut } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [current, setCurrent] = useState<GuardShiftCurrentResponse | null>(null);
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [history, setHistory] = useState<GuardShiftHistoryItem[]>([]);
  const [activity, setActivity] = useState<BitacoraEntryDto[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'change'>('idle');
  const [pickedAccessPointId, setPickedAccessPointId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanResult, setScanResult] = useState<ScanPassResponse | null>(null);
  const [decision, setDecision] = useState<ScanDecisionResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [note, setNote] = useState('');

  /**
   * The activity only exists while a shift is open: it is the bitacora filtered
   * by `shiftId`. Closing the shift clears the list, never the records.
   */
  const loadActivity = useCallback(
    async (shiftId: string | null) => {
      if (!shiftId) {
        setActivity([]);
        setActivityError(null);
        setActivityLoading(false);
        return;
      }
      setActivityLoading(true);
      try {
        const result = await listBitacora(request, { shiftId });
        setActivity(result.items);
        setActivityError(null);
      } catch (activityFailure) {
        setActivityError(errorMessage(activityFailure));
      } finally {
        setActivityLoading(false);
      }
    },
    [request],
  );

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
      await loadActivity(shift.shift?.id ?? null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [loadActivity, request, session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Every hook runs before the early returns below. Otherwise the first render
  // (session still loading) skips this callback and React fails with
  // "Rendered fewer hooks than expected" once the guard session arrives.
  const refresh = useCallback(async () => {
    try {
      const [shift, shifts] = await Promise.all([
        getCurrentShift(request),
        listShifts(request, { page: 1, pageSize: 10 }),
      ]);
      setCurrent(shift);
      setHistory(shifts.items);
      setError(null);
      await loadActivity(shift.shift?.id ?? null);
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    }
  }, [loadActivity, request]);

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

  // The default access point is preselected, but only while it still exists.
  const selectedAccessPointId =
    pickedAccessPointId && accessPoints.some((point) => point.id === pickedAccessPointId)
      ? pickedAccessPointId
      : (defaultAccessPoint?.id ?? accessPoints[0]?.id ?? null);

  const onStart = async () => {
    if (!selectedAccessPointId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await startShift(request, { accessPointId: selectedAccessPointId });
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
    Alert.alert('Cerrar turno', '¿Confirmas el cierre del turno?', [
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
    setCameraOpen(false);
    setNote('');
  };

  /**
   * The camera asks for its permission here, not when the shift starts: a guard
   * that is not scanning should not have the camera running.
   */
  const openCamera = async () => {
    setScanned(false);
    setScanError(null);
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) {
        setScanError(
          'Necesitamos permiso de cámara para escanear el QR. Puedes ingresar el token manualmente.',
        );
        return;
      }
    }
    setCameraOpen(true);
  };

  const runScan = async (qrToken: string) => {
    const value = qrToken.trim();
    if (!value) return;
    setBusy(true);
    setScanError(null);
    setDecision(null);
    setScanResult(null);
    setNote('');
    setScanned(true);
    try {
      const result = await scanPass(request, value);
      setScanResult(result);
    } catch (scanFailure) {
      setScanError(errorMessage(scanFailure));
    } finally {
      setBusy(false);
      setCameraOpen(false);
    }
  };

  const onConfirm = async () => {
    if (!scanResult?.scanId) return;
    setBusy(true);
    setScanError(null);
    try {
      // The field is always visible: whatever the guard wrote travels with the
      // confirmation; an empty or whitespace-only note is simply omitted.
      const result = await confirmScan(request, scanResult.scanId, note.trim() || undefined);
      setDecision(result);
      await refresh();
      // The guard has a line in front: after the decision the scanner resets by
      // itself so the next visitor can be scanned without an extra tap.
      setFlash('Ingreso registrado. Listo para el siguiente.');
      setTimeout(() => {
        setFlash(null);
        resetScan();
      }, 2500);
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
      const result = await rejectScan(request, scanResult.scanId, note.trim() || undefined);
      setDecision(result);
      await refresh();
      setFlash('Ingreso rechazado. Listo para el siguiente.');
      setTimeout(() => {
        setFlash(null);
        resetScan();
      }, 2500);
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
      {/* El header nativo se oculta para que la marca ocupe menos alto: esta
          pantalla es la raíz del flujo del guardia y no necesita volver. */}
      <View style={styles.brandBar}>
        <ZimaLogo height={29} />
      </View>

      <Card>
        <Row>
          <Text style={ui.heading}>{session.user.name}</Text>
          <Badge label={roleLabel(session.activeMembership.role)} tone="info" />
        </Row>
        <Text style={ui.muted}>{session.user.email}</Text>
        {/*
          Comunidad y unidad: el guardia que trabaja en varias comunidades
          necesita confirmar de un vistazo dónde está operando.
        */}
        <Text style={ui.muted}>
          {[session.activeMembership.communityName, session.activeMembership.unitName]
            .filter(Boolean)
            .join(' · ') || 'Sin comunidad asignada'}
        </Text>
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
          <Text style={ui.muted}>Elige el punto de acceso donde vas a cubrir el turno.</Text>
          {!communityId ? (
            <Text style={ui.error}>Tu usuario no tiene una comunidad asignada.</Text>
          ) : null}
          {accessPoints.length === 0 ? (
            <EmptyState
              title="Sin accesos activos"
              message="El administrador todavía no configuró porterías para esta comunidad."
            />
          ) : (
            <>
              {accessPoints.map((point) => {
                const selected = point.id === selectedAccessPointId;
                return (
                  <Pressable
                    key={point.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={point.name}
                    onPress={() => setPickedAccessPointId(point.id)}
                    style={({ pressed }) => [
                      styles.accessOption,
                      selected && styles.accessOptionSelected,
                      pressed && styles.accessOptionPressed,
                    ]}
                  >
                    <Row>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text style={ui.body}>{point.name}</Text>
                      {point.id === session.activeMembership.defaultAccessPointId ? (
                        <Badge label="Asignado" tone="info" />
                      ) : null}
                    </Row>
                    <Text style={ui.muted}>
                      {point.type} · {point.direction}
                    </Text>
                  </Pressable>
                );
              })}
              <Button
                label="Iniciar turno"
                variant="success"
                onPress={() => void onStart()}
                loading={busy}
                disabled={busy || !selectedAccessPointId}
              />
            </>
          )}
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
            <Text style={ui.sectionTitle}>Registro</Text>
            {cameraOpen ? (
              <>
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
                  <View style={styles.aimFrame} pointerEvents="none" />
                </View>
                <Button label="Cancelar" variant="ghost" onPress={() => setCameraOpen(false)} />
              </>
            ) : (
              <Button
                label="Escanear QR"
                variant="secondary"
                onPress={() => void openCamera()}
                disabled={busy}
              />
            )}
            <IdentityCheck request={request} onConfirmed={() => void refresh()} />
          </Card>

          {flash ? (
            <Card>
              <Text style={styles.flash}>{flash}</Text>
            </Card>
          ) : null}

          {scanError ? (
            <Card>
              <Text style={ui.error}>{scanError}</Text>
              <Button label="Escanear otro" variant="secondary" onPress={resetScan} />
            </Card>
          ) : null}

          <Modal
            visible={Boolean(scanResult)}
            transparent
            animationType="fade"
            onRequestClose={resetScan}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Pressable
                  style={styles.modalClose}
                  onPress={resetScan}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Text style={styles.modalCloseText}>X</Text>
                </Pressable>
                {/* The result can carry up to ten companions and the note field:
                    the sheet scrolls instead of pushing the actions off screen. */}
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  keyboardShouldPersistTaps="handled"
                >
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
                      <DetailTable>
                        <DetailRow label="Documento" value={scanResult.visitor.document} />
                        {scanResult.vehiclePlate ? (
                          <DetailRow label="Vehículo" value={scanResult.vehiclePlate} />
                        ) : null}
                        <DetailRow label="Destino" value={scanResult.locationPath} />
                        <DetailRow label="Acceso" value={scanResult.accessPointName} />
                        <DetailRow label="Autoriza" value={scanResult.authorizedByName} />
                        <DetailRow
                          label="Vigencia"
                          value={`${formatDateTime(scanResult.schedule.validFrom)} – ${
                            isPermanentPass(scanResult.schedule.validUntil)
                              ? 'sin fecha de fin'
                              : formatDateTime(scanResult.schedule.validUntil)
                          }`}
                        />
                      </DetailTable>
                      {scanResult.companions.length > 0 ? (
                        <View style={styles.companions}>
                          <Text style={styles.companionsTitle}>
                            {scanResult.companions.length === 1
                              ? 'Acompañante'
                              : `Acompañantes (${scanResult.companions.length})`}
                          </Text>
                          {scanResult.companions.map((companion, index) => (
                            <Text
                              key={`${companion.document}-${index}`}
                              style={styles.companionLine}
                            >
                              {companion.firstName} {companion.lastName} · Doc. {companion.document}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                      {scanResult.reason ? (
                        <Text style={ui.error}>{reasonText(scanResult.reason)}</Text>
                      ) : null}

                      {scanResult.authorized && scanResult.scanId && !decision ? (
                        <>
                          <Field
                            label="Novedad / observación (opcional)"
                            value={note}
                            onChangeText={setNote}
                            placeholder="Ej.: ingresa con equipaje, el documento no coincide…"
                            multiline
                            maxLength={500}
                          />
                          <Text style={ui.muted}>{note.length}/500</Text>
                          <Row>
                            <Button
                              label={
                                scanResult.action === 'exit'
                                  ? 'Registrar salida'
                                  : 'Registrar entrada'
                              }
                              onPress={() => void onConfirm()}
                              loading={busy}
                            />
                            <Button
                              label="Denegar"
                              variant="danger"
                              onPress={() => void onReject()}
                              loading={busy}
                            />
                          </Row>
                        </>
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
                </ScrollView>
              </View>
            </View>
          </Modal>

          <CollapsibleSection
            title="Actividad del turno"
            defaultOpen
            badge={
              activity.length > 0
                ? `${activity.length} ${activity.length === 1 ? 'movimiento' : 'movimientos'}`
                : undefined
            }
          >
            {activityLoading && activity.length === 0 ? (
              <Text style={ui.muted}>Cargando movimientos…</Text>
            ) : null}
            {activityError ? (
              <>
                <Text style={ui.error}>{activityError}</Text>
                <Button
                  label="Reintentar"
                  variant="secondary"
                  onPress={() => void loadActivity(activeShift.id)}
                />
              </>
            ) : null}
            {!activityLoading && !activityError && activity.length === 0 ? (
              <Text style={ui.muted}>Todavía no hay movimientos en este turno.</Text>
            ) : null}
            {activity.map((entry) => {
              const item = toActivityItem(entry);
              return (
                <View key={item.id} style={styles.activityRow}>
                  <Row>
                    <Badge label={item.movement} tone={item.tone} />
                    {item.visitor ? <Text style={ui.body}>{item.visitor}</Text> : null}
                  </Row>
                  <Text style={ui.muted}>
                    {formatTime(item.createdAt)}
                    {item.document ? ` · Doc. ${item.document}` : ''}
                  </Text>
                  {item.destination ? <Text style={ui.muted}>{item.destination}</Text> : null}
                  {item.rule ? <Text style={ui.muted}>{item.rule}</Text> : null}
                  {item.companions.length > 0 ? (
                    <Text style={ui.muted}>
                      Acompañantes:{' '}
                      {item.companions
                        .map((companion) =>
                          companion.document
                            ? `${companion.name} (${companion.document})`
                            : companion.name,
                        )
                        .join(' · ')}
                    </Text>
                  ) : null}
                  {item.vehiclePlate ? (
                    <Text style={ui.muted}>Vehículo: {item.vehiclePlate}</Text>
                  ) : null}
                  {item.note ? <Text style={ui.muted}>Novedad: {item.note}</Text> : null}
                  {item.reason && item.reason !== item.note ? (
                    <Text style={ui.error}>{reasonText(item.reason)}</Text>
                  ) : null}
                </View>
              );
            })}
          </CollapsibleSection>
        </>
      )}

      <CollapsibleSection
        title="Mis turnos"
        badge={
          history.length > 0
            ? `${history.length} ${history.length === 1 ? 'turno' : 'turnos'}`
            : undefined
        }
      >
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
      </CollapsibleSection>

      <Button label="Cerrar sesión" variant="secondary" onPress={() => void onSignOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandBar: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
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
    maxHeight: '85%',
  },
  modalScroll: {
    flexShrink: 1,
  },
  modalScrollContent: {
    paddingBottom: spacing.xs,
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

  flash: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '600',
  },
  companions: {
    gap: 2,
    marginTop: spacing.xs,
  },
  companionsTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  companionLine: {
    color: colors.textMuted,
    fontSize: 14,
  },
  cameraWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    // Cuadrada y a todo el ancho: el marco queda en el centro de la pantalla en
    // vez de una franja baja que obliga a apuntar de costado.
    width: '100%',
    aspectRatio: 1,
  },
  aimFrame: {
    position: 'absolute',
    width: '62%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.lg,
  },
  accessOption: {
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
  },
  accessOptionSelected: {
    borderColor: colors.primary,
  },
  accessOptionPressed: {
    opacity: 0.85,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  activityRow: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyRow: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
