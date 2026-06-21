import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, TypedSocket } from '../types.js';
import type { SignalingState } from '../state.js';
import { broadcastOperatorState } from '../utils.js';
import { persistCallAccept, persistDoorRelay, persistRelayTrigger, persistEvent } from '../persist.js';

export function registerOperatorHandlers(
  socket: TypedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  state: SignalingState,
): void {
  socket.on('operator:register', ({ operatorId, name }) => {
    if (!operatorId) {
      socket.emit('error', 'operatorId requerido');
      return;
    }

    state.operators.set(socket.id, { operatorId, name: name || operatorId });
    socket.data.role = 'operator';
    socket.data.operatorId = operatorId;
    socket.join('operators');

    const kiosksStatus = [...state.kiosks.entries()].map(([buildingId, data]) => ({
      buildingId,
      buildingName: data.buildingName,
      status: data.status,
    }));

    socket.emit('operator:registered', { kiosks: kiosksStatus, serverTime: Date.now() });
  });

  socket.on('call:accept', ({ callId, buildingId }) => {
    const operatorData = state.operators.get(socket.id);
    if (!operatorData) {
      socket.emit('error', 'No eres un operador registrado');
      return;
    }

    const kiosk = state.kiosks.get(buildingId);
    if (!kiosk) {
      socket.emit('error', 'Kiosk no encontrado');
      return;
    }

    kiosk.status = 'in-call';
    state.calls.set(callId, {
      kioskSocketId: kiosk.socketId,
      operatorSocketId: socket.id,
      buildingId,
      startedAt: Date.now(),
    });

    const pendingTimeout = state.callTimeouts.get(callId);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      state.callTimeouts.delete(callId);
    }

    io.to(kiosk.socketId).emit('call:accepted', {
      callId,
      operatorName: operatorData.name,
    });

    socket.to('operators').emit('call:taken', { callId, buildingId });

    socket.emit('call:ready', {
      callId,
      buildingId,
      buildingName: kiosk.buildingName,
    });

    broadcastOperatorState(io, state);
    persistCallAccept(callId, operatorData.operatorId);
  });

  socket.on('door:open', ({ buildingId, callId: _callId }) => {
    const operatorData = state.operators.get(socket.id);
    if (!operatorData) {
      socket.emit('error', 'No autorizado');
      return;
    }

    const kiosk = state.kiosks.get(buildingId);
    if (kiosk) {
      io.to(kiosk.socketId).emit('door:open', {
        authorizedBy: operatorData.name,
        timestamp: Date.now(),
      });
    }

    persistDoorRelay(buildingId);
    persistEvent('door.open', buildingId, {
      actorId: operatorData.operatorId,
      actorRole: 'operator',
    });
  });

  socket.on('relay:trigger', ({ buildingId, relayIndex }) => {
    const operatorData = state.operators.get(socket.id);
    if (!operatorData) {
      socket.emit('error', 'No autorizado');
      return;
    }

    persistRelayTrigger(buildingId, relayIndex);
  });
}
