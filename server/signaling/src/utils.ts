import type { Server as SocketIOServer } from 'socket.io';
import type { KioskStatus, ServerToClientEvents, ClientToServerEvents } from './types.js';
import type { SignalingState } from './state.js';

export function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function broadcastOperatorState(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  state: SignalingState,
): void {
  const kiosksStatus: KioskStatus[] = [...state.kiosks.entries()].map(([buildingId, data]) => ({
    buildingId,
    buildingName: data.buildingName,
    status: data.status,
  }));
  io.to('operators').emit('kiosks:update', kiosksStatus);
}
