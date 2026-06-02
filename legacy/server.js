/**
 * PORTERÍA VIRTUAL — Servidor de Señalización WebRTC
 * Stack: Node.js + Express + Socket.io
 * 
 * Responsabilidades:
 *  - Registrar kiosks (por buildingId) y operadores
 *  - Intermediar el handshake WebRTC (offer/answer/ICE candidates)
 *  - Gestionar el estado de llamadas activas
 *  - Emitir eventos de control de puerta vía MQTT (fase 2)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // En producción: restringir a tu dominio
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// ─── Estado en memoria ────────────────────────────────────────────────────────
// En producción usar Redis para multi-instancia
const state = {
  kiosks: new Map(),     // buildingId → { socketId, buildingName, status }
  operators: new Map(),  // socketId → { operatorId, name }
  calls: new Map(),      // callId → { kiosk, operator, startedAt }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function broadcastOperatorState() {
  const kiosksStatus = [...state.kiosks.entries()].map(([buildingId, data]) => ({
    buildingId,
    ...data,
    socketId: undefined, // no exponer socketId al cliente
  }));
  io.to('operators').emit('kiosks:update', kiosksStatus);
}

// ─── Archivos estáticos (kiosk.html, operator.html, kiosk2.html, etc.) ────────
app.use(express.static(__dirname));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    kiosks: state.kiosks.size,
    operators: state.operators.size,
    activeCalls: state.calls.size,
    uptime: process.uptime(),
  });
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Conexión: ${socket.id}`);

  // ── Registro de Kiosk ──────────────────────────────────────────────────────
  socket.on('kiosk:register', ({ buildingId, buildingName }) => {
    if (!buildingId) return socket.emit('error', 'buildingId requerido');

    state.kiosks.set(buildingId, {
      socketId: socket.id,
      buildingName: buildingName || buildingId,
      status: 'idle', // idle | calling | in-call
      registeredAt: new Date().toISOString(),
    });

    socket.data.role = 'kiosk';
    socket.data.buildingId = buildingId;
    socket.join(`building:${buildingId}`);

    console.log(`[KIOSK] Registrado: ${buildingId} (${buildingName})`);
    socket.emit('kiosk:registered', { buildingId, serverTime: Date.now() });
    broadcastOperatorState();
  });

  // ── Registro de Operador ───────────────────────────────────────────────────
  socket.on('operator:register', ({ operatorId, name }) => {
    if (!operatorId) return socket.emit('error', 'operatorId requerido');

    state.operators.set(socket.id, { operatorId, name: name || operatorId });
    socket.data.role = 'operator';
    socket.data.operatorId = operatorId;
    socket.join('operators');

    console.log(`[OPERATOR] Registrado: ${operatorId} (${name})`);

    // Enviar estado actual de kiosks al operador recién conectado
    const kiosksStatus = [...state.kiosks.entries()].map(([buildingId, data]) => ({
      buildingId,
      buildingName: data.buildingName,
      status: data.status,
    }));
    socket.emit('operator:registered', { kiosks: kiosksStatus, serverTime: Date.now() });
  });

  // ── Visitante identificado por biometría (kiosk → operadores) ──────────────
  socket.on('visitor:identified', ({ buildingId, visitor }) => {
    const kiosk = state.kiosks.get(buildingId || socket.data.buildingId);
    if (!kiosk) return;

    const targetBuildingId = buildingId || socket.data.buildingId;
    console.log(`[BIO] Visitante en ${targetBuildingId}: ${visitor.known ? visitor.name : 'desconocido'} (${(visitor.similarity * 100).toFixed(0)}%)`);

    kiosk.lastVisitor = visitor;

    io.to('operators').emit('visitor:identified', {
      buildingId: targetBuildingId,
      buildingName: kiosk.buildingName,
      visitor,
      timestamp: Date.now(),
    });
  });

  // ── Kiosk inicia llamada ───────────────────────────────────────────────────
  socket.on('call:request', () => {
    const buildingId = socket.data.buildingId;
    if (!buildingId) return socket.emit('error', 'No estás registrado como kiosk');

    const kiosk = state.kiosks.get(buildingId);
    if (!kiosk) return socket.emit('error', 'Kiosk no encontrado');
    if (kiosk.status !== 'idle') return socket.emit('error', 'Kiosk ocupado');

    const callId = generateCallId();
    kiosk.status = 'calling';

    console.log(`[CALL] Solicitud desde ${buildingId} → callId: ${callId}`);

    // Notificar a todos los operadores disponibles (incluye último visitante identificado)
    io.to('operators').emit('call:incoming', {
      callId,
      buildingId,
      buildingName: kiosk.buildingName,
      visitor: kiosk.lastVisitor || null,
      timestamp: Date.now(),
    });

    socket.emit('call:waiting', { callId });
    broadcastOperatorState();
  });

  // ── Operador acepta la llamada ─────────────────────────────────────────────
  socket.on('call:accept', ({ callId, buildingId }) => {
    const operatorData = state.operators.get(socket.id);
    if (!operatorData) return socket.emit('error', 'No eres un operador registrado');

    const kiosk = state.kiosks.get(buildingId);
    if (!kiosk) return socket.emit('error', 'Kiosk no encontrado');

    kiosk.status = 'in-call';
    state.calls.set(callId, {
      kioskSocketId: kiosk.socketId,
      operatorSocketId: socket.id,
      buildingId,
      startedAt: Date.now(),
    });

    console.log(`[CALL] Aceptada: ${callId} | Operador: ${operatorData.name}`);

    // Notificar al kiosk que el operador está listo
    io.to(kiosk.socketId).emit('call:accepted', {
      callId,
      operatorName: operatorData.name,
    });

    // Notificar a otros operadores que la llamada ya fue tomada
    socket.to('operators').emit('call:taken', { callId, buildingId });

    socket.emit('call:ready', { callId, buildingId, buildingName: kiosk.buildingName });
    broadcastOperatorState();
  });

  // ── WebRTC Signaling: Offer (kiosk → operador) ────────────────────────────
  socket.on('webrtc:offer', ({ callId, offer }) => {
    const call = state.calls.get(callId);
    if (!call) return socket.emit('error', 'Llamada no encontrada');

    const targetId = socket.id === call.kioskSocketId
      ? call.operatorSocketId
      : call.kioskSocketId;

    io.to(targetId).emit('webrtc:offer', { callId, offer });
    console.log(`[WebRTC] Offer enviado | callId: ${callId}`);
  });

  // ── WebRTC Signaling: Answer (operador → kiosk) ───────────────────────────
  socket.on('webrtc:answer', ({ callId, answer }) => {
    const call = state.calls.get(callId);
    if (!call) return socket.emit('error', 'Llamada no encontrada');

    const targetId = socket.id === call.operatorSocketId
      ? call.kioskSocketId
      : call.operatorSocketId;

    io.to(targetId).emit('webrtc:answer', { callId, answer });
    console.log(`[WebRTC] Answer enviado | callId: ${callId}`);
  });

  // ── WebRTC Signaling: ICE Candidates ──────────────────────────────────────
  socket.on('webrtc:ice-candidate', ({ callId, candidate }) => {
    const call = state.calls.get(callId);
    if (!call) return;

    const targetId = socket.id === call.kioskSocketId
      ? call.operatorSocketId
      : call.kioskSocketId;

    io.to(targetId).emit('webrtc:ice-candidate', { callId, candidate });
  });

  // ── Control de puerta ──────────────────────────────────────────────────────
  socket.on('door:open', ({ callId, buildingId }) => {
    const operatorData = state.operators.get(socket.id);
    if (!operatorData) return socket.emit('error', 'No autorizado');

    console.log(`[DOOR] Apertura solicitada | buildingId: ${buildingId} | Operador: ${operatorData.name}`);

    // Notificar al kiosk para activar el relay
    const kiosk = state.kiosks.get(buildingId);
    if (kiosk) {
      io.to(kiosk.socketId).emit('door:open', {
        authorizedBy: operatorData.name,
        timestamp: Date.now(),
      });
    }

    // TODO Fase 2: publicar en MQTT → broker → ESP32
    // mqttClient.publish(`porteria/${buildingId}/door/open`, JSON.stringify({ ts: Date.now() }));
  });

  // ── Finalizar llamada ──────────────────────────────────────────────────────
  socket.on('call:end', ({ callId }) => {
    const call = state.calls.get(callId);
    if (!call) return;

    const kiosk = state.kiosks.get(call.buildingId);
    if (kiosk) kiosk.status = 'idle';

    // Notificar al otro extremo
    const targetId = socket.id === call.kioskSocketId
      ? call.operatorSocketId
      : call.kioskSocketId;

    io.to(targetId).emit('call:ended', { callId });
    state.calls.delete(callId);

    console.log(`[CALL] Finalizada: ${callId}`);
    broadcastOperatorState();
  });

  // ── Desconexión ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Desconexión: ${socket.id} (${socket.data.role || 'unknown'})`);

    if (socket.data.role === 'kiosk' && socket.data.buildingId) {
      state.kiosks.delete(socket.data.buildingId);
      broadcastOperatorState();
    }

    if (socket.data.role === 'operator') {
      state.operators.delete(socket.id);
    }

    // Limpiar llamadas activas del socket desconectado
    for (const [callId, call] of state.calls.entries()) {
      if (call.kioskSocketId === socket.id || call.operatorSocketId === socket.id) {
        const targetId = call.kioskSocketId === socket.id
          ? call.operatorSocketId
          : call.kioskSocketId;

        io.to(targetId).emit('call:ended', { callId, reason: 'peer_disconnected' });

        const kiosk = state.kiosks.get(call.buildingId);
        if (kiosk) kiosk.status = 'idle';

        state.calls.delete(callId);
        console.log(`[CALL] Limpiada por desconexión: ${callId}`);
      }
    }
  });
});

// ─── Arranque ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Servidor de señalización corriendo en puerto ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
