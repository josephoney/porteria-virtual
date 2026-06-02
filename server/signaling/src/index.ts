import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Fastify from 'fastify';

const PORT = parseInt(process.env.SIGNALING_PORT || '3001', 10);
const HOST = process.env.SIGNALING_HOST || '0.0.0.0';

const app = Fastify({ logger: true });
const httpServer = createServer(app.server);

const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  app.log.info(`Socket connected: ${socket.id}`);

  socket.on('disconnect', () => {
    app.log.info(`Socket disconnected: ${socket.id}`);
  });
});

app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'signaling',
    connections: io.engine.clientsCount,
    timestamp: Date.now(),
  };
});

httpServer.listen(PORT, HOST, () => {
  app.log.info(`Signaling server listening on port ${PORT}`);
});
