import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, TypedSocket } from '../types.js';
import type { SignalingState } from '../state.js';
import {
  broadcastOperatorState,
  canAccessKiosk,
  getKiosksForOperator,
} from '../utils.js';
import {
  persistCallAccept,
  persistDoorRelay,
  persistRelayTrigger,
  persistEvent,
} from '../persist.js';

function denyActuation(
  socket: TypedSocket,
  state: SignalingState,
  action: string,
  kioskId: string,
) {
  const kiosk = state.kiosks.get(kioskId);
  const operator = state.operators.get(socket.id);
  socket.emit('error', 'No autorizado para operar este kiosk');

  if (kiosk) {
    persistEvent('security.unauthorized_actuation', {
      organizationId: kiosk.organizationId,
      communityId: kiosk.communityId,
      actorId: operator?.operatorId,
      actorRole: operator?.role,
      metadata: { action, kioskId },
    });
  }
}

export function registerOperatorHandlers(
  socket: TypedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  state: SignalingState,
): void {
  socket.on('operator:register', ({ name }) => {
    const operatorId = socket.data.operatorId;
    const orgId = socket.data.orgId;
    const role = socket.data.membershipRole;
    const communityId = socket.data.communityId ?? null;

    if (!operatorId || !orgId || !role) {
      socket.emit('error', 'Sesión de operador inválida');
      return;
    }

    const operatorData = {
      operatorId,
      name: name || socket.data.email || operatorId,
      communityId,
      orgId,
      role,
    };

    state.operators.set(socket.id, operatorData);
    socket.data.role = 'operator';

    if (role === 'org_admin' || !communityId) {
      socket.join(`org:${orgId}`);
    } else {
      socket.join(`community:${communityId}`);
    }

    socket.emit('operator:registered', {
      kiosks: getKiosksForOperator(state, operatorData),
      serverTime: Date.now(),
    });
  });

  socket.on('call:accept', ({ callId, kioskId }) => {
    const operatorData = state.operators.get(socket.id);
    if (!operatorData) {
      socket.emit('error', 'No eres un operador registrado');
      return;
    }

    const kiosk = state.kiosks.get(kioskId);
    if (!kiosk) {
      socket.emit('error', 'Kiosk no encontrado');
      return;
    }

    if (!canAccessKiosk(operatorData, kiosk)) {
      denyActuation(socket, state, 'call.accept', kioskId);
      return;
    }

    kiosk.status = 'in-call';
    state.calls.set(callId, {
      kioskSocketId: kiosk.socketId,
      operatorSocketId: socket.id,
      kioskId,
      communityId: kiosk.communityId,
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

    socket
      .to(`community:${kiosk.communityId}`)
      .to(`org:${kiosk.organizationId}`)
      .emit('call:taken', { callId, kioskId });

    socket.emit('call:ready', {
      callId,
      kioskId,
      kioskRpiId: kiosk.rpiId,
      kioskName: kiosk.kioskName,
      communityId: kiosk.communityId,
    });

    broadcastOperatorState(io, state);
    persistCallAccept(callId, operatorData.operatorId);
  });

  socket.on('door:open', ({ kioskId }) => {
    const operatorData = state.operators.get(socket.id);
    const kiosk = state.kiosks.get(kioskId);

    if (!operatorData || !kiosk || !canAccessKiosk(operatorData, kiosk)) {
      denyActuation(socket, state, 'door.open', kioskId);
      return;
    }

    io.to(kiosk.socketId).emit('door:open', {
      authorizedBy: operatorData.name,
      timestamp: Date.now(),
    });

    persistDoorRelay(kioskId);
    persistEvent('door.open', {
      organizationId: kiosk.organizationId,
      communityId: kiosk.communityId,
      actorId: operatorData.operatorId,
      actorRole: 'operator',
    });
  });

  socket.on('relay:trigger', ({ kioskId, relayIndex }) => {
    const operatorData = state.operators.get(socket.id);
    const kiosk = state.kiosks.get(kioskId);

    if (!operatorData || !kiosk || !canAccessKiosk(operatorData, kiosk)) {
      denyActuation(socket, state, `relay.${relayIndex}`, kioskId);
      return;
    }

    persistRelayTrigger(kioskId, relayIndex);
  });
}
