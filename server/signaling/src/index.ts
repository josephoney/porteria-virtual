import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Fastify from 'fastify';
import type { ClientToServerEvents, ServerToClientEvents, TypedSocket } from './types.js';
import { config } from './config.js';
import { createState } from './state.js';
import { registerKioskHandlers } from './handlers/kiosk.js';
import { registerOperatorHandlers } from './handlers/operator.js';
import { registerCallHandlers } from './handlers/call.js';
import { registerWebRTCHandlers } from './handlers/webrtc.js';
import { broadcastOperatorState } from './utils.js';
import { setPersistLogger, persistCallEnd, persistEvent } from './persist.js';

const app = Fastify({ logger: true });
const httpServer = createServer(app.server);

setPersistLogger({ warn: (obj, msg) => app.log.warn(obj, msg) });

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: config.CORS_ORIGIN, methods: ['GET', 'POST'] },
});

const state = createState();

io.on('connection', (rawSocket) => {
  const socket = rawSocket as TypedSocket;
  app.log.info({ socketId: socket.id }, 'Socket connected');

  registerKioskHandlers(socket, io, state);
  registerOperatorHandlers(socket, io, state);
  registerCallHandlers(socket, io, state);
  registerWebRTCHandlers(socket, io, state);

      socket.on('disconnect', () => {
    const role = socket.data.role || 'unknown';
    app.log.info({ socketId: socket.id, role }, 'Socket disconnected');

    if (socket.data.role === 'kiosk' && socket.data.buildingId) {
      for (const [callId, timeout] of state.callTimeouts.entries()) {
        clearTimeout(timeout);
        state.callTimeouts.delete(callId);
      }
      persistEvent('kiosk.offline', socket.data.buildingId);
      state.kiosks.delete(socket.data.buildingId);
      broadcastOperatorState(io, state);
    }

    if (socket.data.role === 'operator') {
      state.operators.delete(socket.id);
    }

    for (const [callId, call] of state.calls.entries()) {
      if (call.kioskSocketId === socket.id || call.operatorSocketId === socket.id) {
        const targetId =
          call.kioskSocketId === socket.id ? call.operatorSocketId : call.kioskSocketId;

        io.to(targetId).emit('call:ended', { callId, reason: 'peer_disconnected' });

        const kiosk = state.kiosks.get(call.buildingId);
        if (kiosk) kiosk.status = 'idle';

        const now = Date.now();
        const duration = Math.round((now - call.startedAt) / 1000);
        persistCallEnd(callId, 'ended', now, duration);

        state.calls.delete(callId);
        app.log.info({ callId }, 'Call cleaned up on disconnect');
      }
    }
  });
});

app.get('/health', async () => ({
  status: 'ok',
  service: 'signaling',
  kiosks: state.kiosks.size,
  operators: state.operators.size,
  activeCalls: state.calls.size,
  uptime: process.uptime(),
  timestamp: Date.now(),
}));

httpServer.listen(config.PORT, config.HOST, () => {
  app.log.info(`Signaling server listening on port ${config.PORT}`);
});
