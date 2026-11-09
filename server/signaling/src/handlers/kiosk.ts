import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, TypedSocket } from '../types.js';
import type { SignalingState } from '../state.js';
import { generateCallId, broadcastOperatorState, emitToKioskScope } from '../utils.js';
import { config } from '../config.js';
import { persistCallRequest, persistCallEnd, persistEvent } from '../persist.js';

export function registerKioskHandlers(
  socket: TypedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  state: SignalingState,
): void {
  socket.on('kiosk:register', ({ name }) => {
    const kioskId = socket.data.kioskId;
    const communityId = socket.data.communityId;
    const organizationId = socket.data.organizationId;

    if (!kioskId || !communityId || !organizationId) {
      socket.emit('error', 'Sesión de kiosk inválida');
      return;
    }

    const kioskName = name || socket.data.kioskName || kioskId;

    state.kiosks.set(kioskId, {
      socketId: socket.id,
      kioskId,
      rpiId: socket.data.rpiId ?? kioskId,
      communityId,
      organizationId,
      kioskName,
      status: 'idle',
      registeredAt: new Date().toISOString(),
    });

    socket.data.role = 'kiosk';
    socket.join(`kiosk:${kioskId}`);

    socket.emit('kiosk:registered', { kioskId, communityId, serverTime: Date.now() });
    broadcastOperatorState(io, state);
    persistEvent('kiosk.online', { organizationId, communityId });
  });

  socket.on('call:request', async () => {
    const kioskId = socket.data.kioskId;
    const communityId = socket.data.communityId;
    const organizationId = socket.data.organizationId;

    if (!kioskId || !communityId || !organizationId) {
      socket.emit('error', 'No estás registrado como kiosk');
      return;
    }

    const kiosk = state.kiosks.get(kioskId);
    if (!kiosk) {
      socket.emit('error', 'Kiosk no encontrado');
      return;
    }

    if (kiosk.status !== 'idle') {
      kiosk.status = 'idle';
    }

    const callId = generateCallId();
    kiosk.status = 'calling';

    const timeout = setTimeout(() => {
      const current = state.kiosks.get(kioskId);
      if (current && current.status === 'calling') {
        current.status = 'idle';
        socket.emit('call:ended', { callId, reason: 'timeout' });
        emitToKioskScope(io, current, 'call:ended', { callId, reason: 'timeout' });
        broadcastOperatorState(io, state);
        persistCallEnd(callId, 'missed', Date.now());
      }
      state.callTimeouts.delete(callId);
    }, config.CALL_TIMEOUT_MS);
    state.callTimeouts.set(callId, timeout);

    await persistCallRequest(callId, kioskId, kiosk.lastVisitor);

    emitToKioskScope(io, kiosk, 'call:incoming', {
      callId,
      kioskId,
      kioskRpiId: kiosk.rpiId,
      kioskName: kiosk.kioskName,
      communityId,
      visitor: kiosk.lastVisitor || null,
      timestamp: Date.now(),
    });

    socket.emit('call:waiting', { callId });
    broadcastOperatorState(io, state);
  });

  socket.on('visitor:identified', ({ kioskId: targetKioskId, visitor }) => {
    const kioskId = targetKioskId || socket.data.kioskId;
    if (!kioskId) return;

    const kiosk = state.kiosks.get(kioskId);
    if (!kiosk) return;

    kiosk.lastVisitor = visitor;

    emitToKioskScope(io, kiosk, 'visitor:identified', {
      kioskId,
      kioskName: kiosk.kioskName,
      communityId: kiosk.communityId,
      visitor,
      timestamp: Date.now(),
    });
  });
}
