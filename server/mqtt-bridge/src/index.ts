import Fastify from 'fastify';
import mqtt from 'mqtt';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

const PORT = parseInt(process.env.MQTT_BRIDGE_PORT || '3002', 10);
const HOST = process.env.API_HOST || '0.0.0.0';
const MQTT_HOST = process.env.MQTT_HOST || 'localhost';
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883', 10);

// ─── MQTT Client ────────────────────────────────────────────────────────────
let mqttConnected = false;

const mqttClient = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  clientId: `porteria-bridge-${process.pid}`,
  reconnectPeriod: 1000,
  connectTimeout: 5000,
});

mqttClient.on('connect', () => {
  mqttConnected = true;
  console.log('[MQTT] Connected to broker');
  mqttClient.subscribe('porteria/+/relay/+/status', (err) => {
    if (err) console.error('[MQTT] Subscribe error:', err.message);
    else console.log('[MQTT] Subscribed to porteria/+/relay/+/status');
  });
});

mqttClient.on('close', () => {
  mqttConnected = false;
  console.log('[MQTT] Disconnected from broker');
});

mqttClient.on('error', (err) => {
  console.error('[MQTT] Error:', err.message);
});

function publishRelayCommand(
  buildingId: string,
  relayIndex: number,
  payload: { state: string; durationMs?: number; requestId: string },
) {
  const topic = `porteria/${buildingId}/relay/${relayIndex}/set`;
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
}

// ─── Fastify App ────────────────────────────────────────────────────────────
const app = Fastify({ logger: true });

app.get('/health', async () => ({
  status: 'ok',
  service: 'mqtt-bridge',
  mqtt: mqttConnected ? 'connected' : 'disconnected',
  timestamp: Date.now(),
}));

app.post('/relays/trigger', async (request, reply) => {
  const body = request.body as Record<string, unknown>;

  const buildingId = body.buildingId as string;
  const relayIndex = body.relayIndex as number;
  const state = body.state as string;

  if (!buildingId || relayIndex == null || !state) {
    return reply.status(400).send({
      error: 'Validation failed',
      details: 'buildingId, relayIndex, and state are required',
    });
  }

  if (!['ON', 'OFF', 'TOGGLE'].includes(state)) {
    return reply.status(400).send({
      error: 'Validation failed',
      details: 'state must be ON, OFF, or TOGGLE',
    });
  }

  const requestId = (body.requestId as string) || crypto.randomUUID();
  const payload: { state: string; durationMs?: number; requestId: string } = {
    state,
    requestId,
  };
  if (body.durationMs && typeof body.durationMs === 'number') {
    payload.durationMs = body.durationMs;
  }

  publishRelayCommand(buildingId, relayIndex, payload);

  return { ok: true, requestId };
});

// ─── Socket.io ──────────────────────────────────────────────────────────────
const httpServer = createServer();

const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  socket.join('operators');
  console.log('[Socket.io] Operator connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('[Socket.io] Operator disconnected:', socket.id);
  });
});

// Forward MQTT status messages to operators via Socket.io
mqttClient.on('message', (topic, message) => {
  const parts = topic.split('/');
  if (parts.length >= 5 && parts[2] === 'relay') {
    const buildingId = parts[1];
    const relayIndex = parseInt(parts[3], 10);
    try {
      const payload = JSON.parse(message.toString());
      io.to('operators').emit('relay:status', {
        buildingId,
        relayIndex,
        state: payload.state,
        timestamp: payload.timestamp || Date.now(),
      });
    } catch {
      /* malformed message, ignore */
    }
  }
});

// ─── Start: Fastify handles REST, HTTP server handles Socket.io ─────────────
app.ready().then(() => {
  httpServer.on('request', app.server.emit.bind(app.server, 'request'));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`MQTT Bridge listening at http://${HOST}:${PORT}`);
});
