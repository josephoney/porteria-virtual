import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, TypedSocket } from '../types.js';
import type { SignalingState } from '../state.js';
import { generateCallId, broadcastOperatorState } from '../utils.js';
import { config } from '../config.js';
import { persistCallRequest, persistCallEnd, persistEvent } from '../persist.js';

export function registerKioskHandlers(
  socket: TypedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  state: SignalingState,
): void {
  socket.on('kiosk:register', ({ buildingId, buildingName }) => {
    if (!buildingId) {
      socket.emit('error', 'buildingId requerido');
      return;
    }

    state.kiosks.set(buildingId, {
      socketId: socket.id,
      buildingName: buildingName || buildingId,
      status: 'idle',
      registeredAt: new Date().toISOString(),
    });

    socket.data.role = 'kiosk';
    socket.data.buildingId = buildingId;
    socket.join(`building:${buildingId}`);

    socket.emit('kiosk:registered', { buildingId, serverTime: Date.now() });
    broadcastOperatorState(io, state);
    persistEvent('kiosk.online', buildingId);
  });

  socket.on('call:request', () => {
    const buildingId = socket.data.buildingId;

    if (!buildingId) {
      socket.emit('error', 'No estás registrado como kiosk');
      return;
    }

    const kiosk = state.kiosks.get(buildingId);
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
      const k = state.kiosks.get(buildingId);
      if (k && k.status === 'calling') {
        k.status = 'idle';
        socket.emit('call:ended', { callId, reason: 'timeout' });
        io.to('operators').emit('call:ended', { callId, reason: 'timeout' });
        broadcastOperatorState(io, state);
        persistCallEnd(callId, 'missed', Date.now());
      }
      state.callTimeouts.delete(callId);
    }, config.CALL_TIMEOUT_MS);
    state.callTimeouts.set(callId, timeout);

    io.to('operators').emit('call:incoming', {
      callId,
      buildingId,
      buildingName: kiosk.buildingName,
      visitor: kiosk.lastVisitor || null,
      timestamp: Date.now(),
    });

    socket.emit('call:waiting', { callId });
    broadcastOperatorState(io, state);

    persistCallRequest(callId, buildingId, kiosk.lastVisitor);
  });

  socket.on('visitor:identified', ({ buildingId, visitor }) => {
    const targetBuildingId = buildingId || socket.data.buildingId;
    if (!targetBuildingId) return;

    const kiosk = state.kiosks.get(targetBuildingId);
    if (!kiosk) return;

    kiosk.lastVisitor = visitor;

    io.to('operators').emit('visitor:identified', {
      buildingId: targetBuildingId,
      buildingName: kiosk.buildingName,
      visitor,
      timestamp: Date.now(),
    });
  });
}
