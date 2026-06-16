import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, TypedSocket } from '../types.js';
import type { SignalingState } from '../state.js';
import { broadcastOperatorState } from '../utils.js';
import { persistCallEnd } from '../persist.js';

export function registerCallHandlers(
  socket: TypedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  state: SignalingState,
): void {
  socket.on('call:end', ({ callId, buildingId }: { callId: string; buildingId?: string }) => {
    const pendingTimeout = state.callTimeouts.get(callId);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      state.callTimeouts.delete(callId);
    }

    const call = state.calls.get(callId);

    if (!call) {
      if (socket.data.role === 'kiosk' && socket.data.buildingId) {
        const kiosk = state.kiosks.get(socket.data.buildingId);
        if (kiosk) {
          kiosk.status = 'idle';
        }
      }
      if (buildingId) {
        const kiosk = state.kiosks.get(buildingId);
        if (kiosk && kiosk.status === 'calling') {
          kiosk.status = 'idle';
          io.to(kiosk.socketId).emit('call:ended', { callId, reason: 'cancelled' });
        }
      }
      socket.emit('call:ended', { callId, reason: 'cancelled' });
      io.to('operators').emit('call:ended', { callId, reason: 'cancelled' });
      broadcastOperatorState(io, state);
      persistCallEnd(callId, 'missed', Date.now());
      return;
    }

    const kiosk = state.kiosks.get(call.buildingId);
    if (kiosk) kiosk.status = 'idle';

    const targetId =
      socket.id === call.kioskSocketId ? call.operatorSocketId : call.kioskSocketId;

    io.to(targetId).emit('call:ended', { callId });
    state.calls.delete(callId);

    broadcastOperatorState(io, state);

    const now = Date.now();
    const duration = Math.round((now - call.startedAt) / 1000);
    persistCallEnd(callId, 'ended', now, duration);
  });
}
