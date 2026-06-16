## Context

`legacy/server.js` implementa todo el signaling con Express + Socket.io en un archivo monolítico de 356 líneas. `server/signaling/` es un esqueleto Fastify + Socket.io de 34 líneas. El objetivo es migrar a TypeScript manteniendo compatibilidad total con las apps React existentes.

## Goals / Non-Goals

**Goals:**
- Replicar la funcionalidad completa de `legacy/server.js` en TypeScript
- Mantener compatibilidad de eventos Socket.io (mismos nombres, mismos payloads)
- Structured logging con pino (vía Fastify)
- Tipos TypeScript para todos los eventos, payloads y estado
- Separación de handlers por dominio (kiosk, operator, webrtc, call)
- Health check extendido con métricas (kiosks count, operators count, active calls)
- Call timeout de 30 segundos
- Limpieza de estado en desconexión (calls activas, timeouts pendientes)

**Non-Goals:**
- No se persisten llamadas en PostgreSQL (fase siguiente)
- No se integra Redis para estado multi-instancia (fase siguiente)
- No se integra MQTT para control GPIO (fase siguiente — el `TODO Fase 2` del legacy queda igual)
- No se modifican las apps React (kiosk, dashboard)
- No se agregan nuevos eventos o features

## Decisions

### 1. Fastify con http.Server compartido para Socket.io

**Decisión**: Usar `http.createServer(app.server)` para compartir el servidor HTTP entre Fastify y Socket.io, igual que el esqueleto actual.

```typescript
const app = Fastify({ logger: true });
const httpServer = createServer(app.server);
const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
```

**Razonamiento**: Fastify provee structured logging (pino), health check endpoint, y CORS. Socket.io se monta sobre el mismo HTTP server. Es la misma arquitectura que el esqueleto actual y que `legacy/server.js` (Express + http.Server + Socket.io).

### 2. Handlers separados por dominio

**Decisión**: Dividir los event handlers en archivos por dominio, cada uno recibiendo las dependencias que necesita.

```
server/signaling/src/
├── index.ts              ← Bootstrap + health check
├── config.ts             ← PORT, CORS, TIMEOUT_MS
├── state.ts              ← In-memory state (Maps)
├── types.ts              ← TypedSocket, event payloads
├── handlers/
│   ├── kiosk.ts          ← kiosk:register, call:request, visitor:identified
│   ├── operator.ts       ← operator:register, call:accept, door:open
│   ├── webrtc.ts         ← webrtc:offer, webrtc:answer, webrtc:ice-candidate
│   └── call.ts           ← call:end, timeout logic, disconnect cleanup
└── utils.ts              ← generateCallId, broadcastOperatorState
```

**Razonamiento**: Separación clara de concerns. Cada handler se puede testear unitariamente inyectando mocks de `io` y `state`. El legacy tiene todo en un solo bloque `io.on('connection', ...)` — esto hace imposible testear handlers individuales.

### 3. Estado tipado con Maps (paridad con legacy)

**Decisión**: Mantener el mismo modelo de estado en memoria que el legacy, pero con tipos TypeScript.

```typescript
interface KioskData {
  socketId: string;
  buildingName: string;
  status: 'idle' | 'calling' | 'in-call';
  registeredAt: string;
  lastVisitor?: VisitorData;
}

interface OperatorData {
  operatorId: string;
  name: string;
}

interface CallData {
  kioskSocketId: string;
  operatorSocketId: string;
  buildingId: string;
  startedAt: number;
}

interface SignalingState {
  kiosks: Map<string, KioskData>;
  operators: Map<string, OperatorData>;
  calls: Map<string, CallData>;
  callTimeouts: Map<string, NodeJS.Timeout>;
}
```

**Razonamiento**: Misma estructura que el legacy, misma semántica. Los Maps son el tipo nativo correcto para este patrón (key-value con búsqueda O(1)). Cuando se migre a Redis en el futuro, la interfaz será similar (HSET/GET con keys).

### 4. Tipos de eventos Socket.io con TypeScript

**Decisión**: Definir interfaces tipadas para todos los eventos del protocolo, permitiendo autocompletado y type-checking en los handlers.

```typescript
interface ServerToClientEvents {
  'kiosk:registered': (data: { buildingId: string; serverTime: number }) => void;
  'call:waiting': (data: { callId: string }) => void;
  'call:accepted': (data: { callId: string; operatorName: string }) => void;
  'call:ended': (data: { callId: string; reason?: string }) => void;
  // ...
}

interface ClientToServerEvents {
  'kiosk:register': (data: { buildingId: string; buildingName: string }) => void;
  'call:request': () => void;
  'call:end': (data: { callId: string }) => void;
  // ...
}
```

**Razonamiento**: Socket.io soporta tipos genéricos en su constructor (`Server<ClientToServer, ServerToClient>`). Esto da type safety end-to-end en los handlers y previene errores de payload.

### 5. Call timeout replicado del legacy

**Decisión**: Implementar el mismo timeout de 30 segundos que `legacy/server.js` agregó en el change `fix-call-flow`.

**Razonamiento**: Ya está probado y las apps React lo esperan. Se limpia en `call:accept`, `call:end`, y `disconnect`.

### 6. Health check extendido

**Decisión**: Agregar métricas de estado al endpoint `/health`.

```typescript
app.get('/health', async () => ({
  status: 'ok',
  service: 'signaling',
  kiosks: state.kiosks.size,
  operators: state.operators.size,
  activeCalls: state.calls.size,
  uptime: process.uptime(),
  timestamp: Date.now(),
}));
```

**Razonamiento**: El legacy ya expone estas métricas. El esqueleto actual solo muestra `connections`. Extenderlo da visibilidad operacional.

### 7. Puerto por defecto: 3001 (paridad con legacy)

**Decisión**: Cambiar el puerto por defecto de `3003` a `3001` para que coincida con el legacy y las apps React no necesiten reconfigurarse.

**Razonamiento**: Las apps React (kiosk, dashboard) se conectan a `http://localhost:3001`. Cambiar el puerto del signaling server TypeScript a 3001 permite hacer el switch sin tocar configs de las apps.

### 8. Eventos Socket.io — protocolo exacto

Se replican **todos** los eventos del legacy, sin cambios:

**Kiosk → Server:**
| Evento | Payload |
|--------|---------|
| `kiosk:register` | `{ buildingId, buildingName }` |
| `call:request` | (usa socket.data.buildingId) |
| `call:end` | `{ callId }` |
| `webrtc:offer` | `{ callId, offer }` |
| `webrtc:ice-candidate` | `{ callId, candidate }` |
| `visitor:identified` | `{ buildingId, visitor }` |

**Server → Kiosk:**
| Evento | Payload |
|--------|---------|
| `kiosk:registered` | `{ buildingId, serverTime }` |
| `call:waiting` | `{ callId }` |
| `call:accepted` | `{ callId, operatorName }` |
| `call:ended` | `{ callId, reason? }` |
| `webrtc:answer` | `{ callId, answer }` |
| `webrtc:ice-candidate` | `{ callId, candidate }` |
| `door:open` | `{ authorizedBy, timestamp }` |

**Operator → Server:**
| Evento | Payload |
|--------|---------|
| `operator:register` | `{ operatorId, name }` |
| `call:accept` | `{ callId, buildingId }` |
| `call:end` | `{ callId }` |
| `webrtc:answer` | `{ callId, answer }` |
| `webrtc:ice-candidate` | `{ callId, candidate }` |
| `door:open` | `{ callId, buildingId }` |

**Server → Operator:**
| Evento | Payload |
|--------|---------|
| `operator:registered` | `{ kiosks[], serverTime }` |
| `kiosks:update` | `KioskStatus[]` |
| `call:incoming` | `{ callId, buildingId, buildingName, visitor?, timestamp }` |
| `call:taken` | `{ callId, buildingId }` |
| `call:ended` | `{ callId }` |
| `webrtc:offer` | `{ callId, offer }` |
| `webrtc:ice-candidate` | `{ callId, candidate }` |
| `visitor:identified` | `{ buildingId, buildingName, visitor, timestamp }` |

## Risks / Trade-offs

- **[Riesgo] Eventos no documentados**: `legacy/server.js` puede tener comportamientos sutiles no evidentes a simple vista. Se mitiga haciendo diff testing: correr el legacy y el nuevo server lado a lado en tests.
- **[Trade-off] Sin persistencia**: Las llamadas no se guardan en DB. Si el servidor se reinicia, se pierde el historial de la sesión. Es aceptable porque es paridad con el legacy — la persistencia se agrega en el próximo change.
- **[Riesgo] Puerto 3001 en conflicto**: Si alguien corre el legacy y el nuevo server al mismo tiempo, hay conflicto de puerto. Se documenta en el README.
- **[Trade-off] Sin MQTT**: El `TODO Fase 2` del legacy (publicar door:open en MQTT) queda pendiente. El control de puerta actual solo notifica al kiosk vía Socket.io, no activa el relay GPIO.
