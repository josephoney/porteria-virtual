import type { Server as SocketIOServer } from 'socket.io';
import type {
  KioskData,
  KioskStatus,
  OperatorData,
  ServerToClientEvents,
  ClientToServerEvents,
} from './types.js';
import type { SignalingState } from './state.js';

export function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function toKioskStatus(data: KioskData): KioskStatus {
  return {
    kioskId: data.kioskId,
    rpiId: data.rpiId,
    communityId: data.communityId,
    kioskName: data.kioskName,
    status: data.status,
  };
}

export function canAccessKiosk(operator: OperatorData, kiosk: KioskData): boolean {
  if (operator.role === 'org_admin') {
    return operator.orgId === kiosk.organizationId;
  }
  return operator.communityId === kiosk.communityId;
}

export function getKiosksForOperator(
  state: SignalingState,
  operator: OperatorData,
): KioskStatus[] {
  return [...state.kiosks.values()]
    .filter((kiosk) => canAccessKiosk(operator, kiosk))
    .map(toKioskStatus);
}

export function emitToKioskScope(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  kiosk: KioskData,
  event: keyof ServerToClientEvents,
  payload: Record<string, unknown>,
): void {
  const room = io
    .to(`community:${kiosk.communityId}`)
    .to(`org:${kiosk.organizationId}`);
  (room as unknown as {
    emit: (event: string, payload: Record<string, unknown>) => void;
  }).emit(event, payload);
}

export function broadcastOperatorState(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  state: SignalingState,
): void {
  const byCommunity = new Map<string, KioskStatus[]>();
  const byOrganization = new Map<string, KioskStatus[]>();

  for (const data of state.kiosks.values()) {
    const status = toKioskStatus(data);

    const communityList = byCommunity.get(data.communityId) ?? [];
    communityList.push(status);
    byCommunity.set(data.communityId, communityList);

    const organizationList = byOrganization.get(data.organizationId) ?? [];
    organizationList.push(status);
    byOrganization.set(data.organizationId, organizationList);
  }

  for (const [communityId, list] of byCommunity) {
    io.to(`community:${communityId}`).emit('kiosks:update', list);
  }
  for (const [organizationId, list] of byOrganization) {
    io.to(`org:${organizationId}`).emit('kiosks:update', list);
  }
}
