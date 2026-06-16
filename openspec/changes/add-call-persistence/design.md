## Context

El signaling server maneja el ciclo de vida de llamadas 100% en memoria (`state.calls`, `state.callTimeouts`). Las tablas `calls` y `events` existen en PostgreSQL pero nunca reciben datos. Los endpoints `GET /api/calls` y `GET /api/events` están implementados pero devuelven vacío.

**Current architecture (lectura, sin datos):**
```
Kiosk ──call:request──▶ Signaling (memoria) ──call:incoming──▶ Operators
Kiosk ──call:end──────▶ Signaling (memoria) ──call:ended─────▶ Operators
                              │
                              ✗ (nunca escribe a DB)
                              
API Server ← GET /api/calls ← AdminPanel (siempre vacío)
API Server ← GET /api/events ← (sin consumidor)
```

**Target architecture (lectura + escritura):**
```
Kiosk ──call:request──▶ Signaling ──POST /api/internal/calls──▶ API Server ──▶ PostgreSQL
                        ├─call:incoming──▶ Operators                    ├─ INSERT calls (pending)
                        └─call:waiting──▶ Kiosk                         └─ INSERT events (call.started)

Operator ──call:accept─▶ Signaling ──PATCH /api/internal/calls─▶ API Server ──▶ PostgreSQL
                         ├─call:accepted──▶ Kiosk                        └─ UPDATE calls (active, operatorId)
                         └─call:ready─────▶ Operator

Either ──call:end──────▶ Signaling ──PATCH /api/internal/calls─▶ API Server ──▶ PostgreSQL
Timeout (30s)──────────▶ Signaling ──PATCH /api/internal/calls─▶ API Server     ├─ UPDATE calls (ended/missed)
                                                                               └─ INSERT events (call.ended/missed)

AdminPanel ──GET /api/calls──▶ API Server ──▶ PostgreSQL (ya con datos)
OperatorPanel ──GET /api/calls?operatorId=X──▶ API Server ──▶ PostgreSQL
```

## Goals / Non-Goals

**Goals:**
- Cada call:request crea un registro en `calls` con status `pending` y un evento `call.started`
- Cada call:accept actualiza el registro con `operatorId` y status `active`
- Cada call:end (normal, cancel, timeout, disconnect) actualiza el registro con status, endedAt, duration y crea evento `call.ended` o `call.missed`
- AdminPanel muestra historial completo paginado con filtros por status y fecha
- OperatorPanel muestra historial personal (solo sus calls)
- Las llamadas HTTP del signaling al API son fire-and-forget (no bloquean eventos socket)
- Cero cambios en el protocolo socket (kiosk y dashboard no cambian)

**Non-Goals:**
- Eventos de puerta (`door:open`) en la DB
- Eventos de visitante identificado en la DB
- Dashboard para events (solo calls en este change)
- Métricas/agregaciones avanzadas (solo counts básicos ya existentes)
- Migración de datos históricos (no hay, todo era en memoria)

## Decisions

### 1. API interna con key compartida

Los endpoints internos no usan JWT (el signaling no tiene usuario). En su lugar, usan un header `X-Internal-Key`:

```typescript
// server/api/src/config.ts
internalApiKey: process.env.INTERNAL_API_KEY || 'dev-internal-key-change-me'

// Middleware en las rutas internas:
app.addHook('preHandler', async (request, reply) => {
  const key = request.headers['x-internal-key'];
  if (key !== config.internalApiKey) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
});
```

La key se configura vía variable de entorno `INTERNAL_API_KEY` en ambos servidores. En desarrollo, usan el mismo default.

### 2. Resolución de IDs: buildingId → kioskId → organizationId

El signaling server conoce `buildingId` (string = `rpiId` del kiosk). El API server resuelve la cadena completa:

```sql
SELECT k.id AS kiosk_id, k.access_point_id, l.organization_id
FROM kiosks k
LEFT JOIN access_points ap ON k.access_point_id = ap.id
LEFT JOIN locations l ON ap.location_id = l.id
WHERE k.rpi_id = $buildingId
```

Si el kiosk no tiene `accessPointId` (nullable), `accessPointId` y `organizationId` serán null. En ese caso, `organizationId` es obligatorio en la tabla `calls` → el endpoint retorna 400 "Kiosk not linked to an organization".

**Alternativa considerada:** Que el signaling tenga acceso directo a DB. Descartada: acoplamiento fuerte, duplicación de lógica de queries, el signaling no tiene drizzle configurado.

### 3. Signaling: fire-and-forget con manejo de errores silencioso

Las llamadas HTTP del signaling al API no deben bloquear ni afectar el flujo socket. Si la API falla, el signaling sigue funcionando normalmente (la llamada sigue su curso en memoria).

```typescript
function persistCall(callId: string, buildingId: string, visitor?: VisitorData | null) {
  fetch(`${config.API_BASE_URL}/api/internal/calls`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': config.INTERNAL_API_KEY,
    },
    body: JSON.stringify({ callId, buildingId, visitor }),
  }).catch((err) => {
    app.log.warn({ callId, err: err.message }, 'Failed to persist call');
  });
}
```

El `app.log` es el logger de Fastify que ya tiene el signaling server.

**Alternativa considerada:** `await` con try/catch. Descartada: si la API tarda 200ms, el evento socket se demora 200ms. Fire-and-forget mantiene la latencia del signaling en ~0ms.

### 4. `events.service.ts` — inserción simple

Nuevo servicio mínimo para insertar eventos. No necesita lectura (el endpoint `GET /api/events` ya existe en `events.routes.ts`):

```typescript
// server/api/src/services/events.service.ts
import { createDb } from '@porteria/database';
import { events } from '@porteria/database/schema';

const db = createDb();

export async function insertEvent(event: {
  eventType: string;
  actorId?: string;
  actorRole?: string;
  organizationId: string;
  locationId?: string;
  accessPointId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(events).values({
    eventType: event.eventType,
    actorId: event.actorId || null,
    actorRole: event.actorRole || null,
    organizationId: event.organizationId,
    locationId: event.locationId || null,
    accessPointId: event.accessPointId || null,
    metadata: event.metadata || null,
  });
}
```

### 5. `calls.service.ts` — nuevas funciones de escritura

```typescript
export async function createCall(input: {
  callId: string;
  buildingId: string;
  visitor?: { name?: string; known?: boolean } | null;
}): Promise<{ success: boolean; error?: string }> {
  // 1. Resolver kiosk
  const [kiosk] = await db
    .select({ id: kiosks.id, accessPointId: kiosks.accessPointId })
    .from(kiosks)
    .where(eq(kiosks.rpiId, input.buildingId))
    .limit(1);

  if (!kiosk) return { success: false, error: 'Kiosk not found' };

  // 2. Resolver organizationId vía accessPoint → location
  let organizationId: string | null = null;
  if (kiosk.accessPointId) {
    const [ap] = await db
      .select({ locationId: accessPoints.locationId })
      .from(accessPoints)
      .where(eq(accessPoints.id, kiosk.accessPointId))
      .limit(1);
    if (ap) {
      const [loc] = await db
        .select({ organizationId: locations.organizationId })
        .from(locations)
        .where(eq(locations.id, ap.locationId))
        .limit(1);
      if (loc) organizationId = loc.organizationId;
    }
  }

  if (!organizationId) {
    return { success: false, error: 'Kiosk not linked to an organization' };
  }

  // 3. Insert call
  await db.insert(calls).values({
    id: input.callId,
    kioskId: kiosk.id,
    organizationId,
    accessPointId: kiosk.accessPointId,
    status: 'pending',
  });

  // 4. Insert event
  await insertEvent({
    eventType: 'call.started',
    actorRole: 'kiosk',
    organizationId,
    accessPointId: kiosk.accessPointId || undefined,
    metadata: input.visitor ? { visitor: input.visitor } : undefined,
  });

  return { success: true };
}

export async function updateCall(callId: string, input: {
  status?: string;
  operatorId?: string;
  endedAt?: string;
  duration?: number;
  eventType?: string; // 'call.ended' | 'call.missed'
}): Promise<{ success: boolean; error?: string }> {
  const updates: Record<string, unknown> = {};
  if (input.status) updates.status = input.status;
  if (input.operatorId !== undefined) updates.operatorId = input.operatorId || null;
  if (input.endedAt) updates.endedAt = new Date(input.endedAt);
  if (input.duration !== undefined) updates.duration = input.duration;

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No fields to update' };
  }

  await db.update(calls).set(updates).where(eq(calls.id, callId));

  // Insert event if eventType provided
  if (input.eventType) {
    const [call] = await db
      .select({ organizationId: calls.organizationId })
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);

    if (call) {
      await insertEvent({
        eventType: input.eventType,
        actorRole: input.operatorId ? 'operator' : 'kiosk',
        organizationId: call.organizationId,
        metadata: input.duration !== undefined ? { duration: input.duration } : undefined,
      });
    }
  }

  return { success: true };
}
```

### 6. Seguridad del filtro `operatorId`

En `GET /api/calls`, si el usuario JWT tiene rol `operator`, el parámetro `operatorId` se ignora y se fuerza a `user.sub`. Si es `admin`, se respeta el filtro (o se omite para ver todas).

```typescript
app.get('/', { preHandler: [requireRole('admin', 'operator')] }, async (request) => {
  const u = getUser(request);
  const query = callsQuerySchema.parse(request.query);
  
  // Force operatorId to own ID for non-admin users
  const effectiveOperatorId = u.role !== 'admin' ? u.sub : query.operatorId;
  
  return callsService.listCalls(u.orgId, { ...query, operatorId: effectiveOperatorId });
});
```

### 7. CallHistoryTable — diseño del componente

```
┌──────────────────────────────────────────────────────────────────┐
│  Historial de Llamadas                                           │
│                                                                   │
│  [Estado: Todas ▼]  [Desde: __/__/____]  [Hasta: __/__/____]    │
│                                                                   │
│  ┌────────┬──────────┬──────────┬────────┬──────────┬──────────┐ │
│  │ Estado │ Kiosk    │ Operador │ Acceso │ Inicio   │ Dur.     │ │
│  ├────────┼──────────┼──────────┼────────┼──────────┼──────────┤ │
│  │ active │ Edificio │ Juan     │ Puerta │ 14:32:15 │ --       │ │
│  │ ended  │ Torre A  │ María    │ Portón │ 14:15:00 │ 45s      │ │
│  │ missed │ Edificio │ --       │ Puerta │ 13:50:00 │ --       │ │
│  └────────┴──────────┴──────────┴────────┴──────────┴──────────┘ │
│                                                                   │
│                                              ← 1 / 5 →           │
└──────────────────────────────────────────────────────────────────┘
```

- Usa `apiClient.get()` del módulo existente
- Paginación: 10 items por página
- Filtros: dropdown de status + inputs de fecha
- Status badges con colores: pending (gris), active (verde), ended (azul), missed (ámbar)
- Auto-refresh cada 30s para detectar llamadas activas nuevas

### 8. OperatorPanel — sección "Mis llamadas"

Se agrega un bloque colapsable debajo del EventLog:

```
┌──────────────────────────────────────────┐
│  Mis llamadas recientes          [▼/▲]   │
│                                           │
│  ┌──────────┬──────────┬────────────────┐ │
│  │ Kiosk    │ Fecha    │ Estado         │ │
│  ├──────────┼──────────┼────────────────┤ │
│  │ Edificio │ 14:32    │ Atendida       │ │
│  │ Torre A  │ 12:15    │ Perdida        │ │
│  └──────────┴──────────┴────────────────┘ │
└──────────────────────────────────────────┘
```

- Muestra últimas 50 calls del operador
- GET /api/calls?operatorId=<id>&pageSize=50
- Sin paginación (scroll si hay muchas)
- Se actualiza al montar y cada 60s

## Risks / Trade-offs

- **[Fire-and-forget puede perder datos]**: Si el signaling envía el POST pero la API está caída, la call no se persiste. → Mitigación: el signaling loguea el error. En el futuro se puede agregar un buffer/retry, pero para MVP es aceptable (la funcionalidad core de videollamada no se ve afectada).
- **[Doble source of truth]**: El signaling tiene `state.calls` en memoria y PostgreSQL tiene la tabla `calls`. Pueden divergir si el HTTP falla. → Trade-off aceptado: la memoria es la fuente de verdad operativa (la llamada en curso), PostgreSQL es la fuente de verdad histórica.
- **[callId como UUID]**: El signaling genera IDs tipo `call_<timestamp>_<random>`. La tabla `calls` tiene `id UUID`. → El `callId` del signaling se usa como `id` en la DB. PostgreSQL acepta cualquier string en una columna UUID (no valida formato). Si en el futuro se quiere UUID real, se cambia el `generateCallId()`.
- **[organizationId lookup frágil]**: Si un kiosk no tiene `accessPointId` o su access point no tiene `locationId` o su location no tiene `organizationId`, la call no se puede crear. → Mitigación: el endpoint retorna error claro. En seed data, toda la cadena está completa. En producción, el admin debe asegurarla.
