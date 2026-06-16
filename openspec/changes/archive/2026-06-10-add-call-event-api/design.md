## Context

`server/api/` tiene auth (login, refresh, logout) y users CRUD funcionando con RBAC. La DB tiene el schema completo con 12 tablas incluyendo calls, events, kiosks, access_points, locations, organizations. Pero solo users y refresh_tokens tienen servicios/rutas expuestos.

El patrón existente es: `routes/*.routes.ts` → `services/*.service.ts` → Drizzle queries. Los servicios crean su propia conexión DB con `createDb()` (no usan `app.decorate('db')`).

## Goals / Non-Goals

**Goals:**
- Exponer historial de llamadas paginado con filtros (status, fecha)
- Exponer bitácora de eventos paginada con filtros (tipo, rango de fechas)
- Listar kiosks con su estado y relaciones (access point, location)
- Endpoint agregado de stats para el dashboard
- Seguir el mismo patrón de código que users (Zod validation, RBAC middleware, service layer)
- Joins para incluir nombres de kiosk, operador en llamadas (no solo UUIDs)

**Non-Goals:**
- No se implementa POST/PATCH para calls o events (son write-only desde el signaling)
- No se implementa POST para kiosks (se gestionan desde el signaling o seed)
- No se modifica el patrón de `createDb()` por servicio (se sigue el patrón existente)
- No se modifican los tipos compartidos (aunque tengan ligeras discrepancias con el schema)
- No se implementan gráficos ni reportes (Fase 3)

## Decisions

### 1. Estructura de archivos — mismo patrón que users

**Decisión**: Cada entidad tiene su `routes/*.routes.ts` y `services/*.service.ts`, siguiendo exactamente el mismo patrón que `users.routes.ts` + `users.service.ts`.

```
server/api/src/
├── routes/
│   ├── calls.routes.ts      ← GET /calls, GET /calls/:id
│   ├── events.routes.ts     ← GET /events, GET /events/stats
│   └── kiosks.routes.ts     ← GET /kiosks
├── services/
│   ├── calls.service.ts     ← listCalls, getCallById, getCallStats
│   ├── events.service.ts    ← listEvents, getEventStats
│   └── kiosks.service.ts    ← listKiosks, getDashboardStats
└── index.ts                 ← register new route prefixes
```

**Razonamiento**: Consistencia con el código existente. Cualquier dev que entienda users.routes.ts entiende calls.routes.ts inmediatamente.

### 2. Joins con Drizzle para nombres legibles

**Decisión**: Las queries de calls incluyen joins a `kiosks` (name) y `users` (operator name) para devolver nombres en vez de solo UUIDs.

```typescript
const rows = await db
  .select({
    id: calls.id,
    status: calls.status,
    startedAt: calls.startedAt,
    endedAt: calls.endedAt,
    duration: calls.duration,
    kioskName: kiosks.name,
    operatorName: users.name,
    buildingName: accessPoints.name,
  })
  .from(calls)
  .leftJoin(kiosks, eq(calls.kioskId, kiosks.id))
  .leftJoin(users, eq(calls.operatorId, users.id))
  .leftJoin(accessPoints, eq(calls.accessPointId, accessPoints.id))
  .where(eq(calls.organizationId, orgId))
  .orderBy(desc(calls.startedAt))
  .limit(pageSize).offset(offset);
```

**Razonamiento**: El dashboard muestra nombres de edificios y operadores, no UUIDs. Hacer el join en la query evita N+1 requests y simplifica el frontend.

### 3. Filtros como query params (no body)

**Decisión**: Paginación y filtros van como query params, validados con Zod.

```
GET /api/calls?page=1&pageSize=20&status=active
GET /api/events?page=1&pageSize=20&eventType=door.open&from=2026-06-01&to=2026-06-10
```

**Razonamiento**: REST idiomático. Query params para filtros, no body en GET. Zod `coerce` para transformar strings a números/dates.

### 4. Dashboard stats en endpoint dedicado

**Decisión**: `GET /api/dashboard/stats` devuelve un objeto agregado con counts.

```json
{
  "totalKiosks": 3,
  "activeCalls": 1,
  "callsToday": 12,
  "eventsToday": 47,
  "onlineKiosks": 2
}
```

**Razonamiento**: El dashboard necesita estas stats en la carga inicial. Un solo endpoint evita 4 requests separados. Se usa `count()` y filtros `gte(createdAt, today)` de Drizzle.

### 5. RBAC: admin + operator pueden ver calls/events/kiosks

**Decisión**: Calls y events accesibles a `admin` y `operator`. Guard solo ve su propio panel (placeholder, sin API específica aún). Resident no accede a nada de esto.

```typescript
{ preHandler: [requireRole('admin', 'operator')] }
```

**Razonamiento**: El operador necesita ver el historial de llamadas y eventos de su turno. El admin necesita todo. Guard y resident no necesitan este acceso.

### 6. No modificamos los tipos compartidos

**Decisión**: Los servicios usan tipos inferidos de Drizzle (`typeof calls.$inferSelect`) o interfaces locales, no los tipos de `@porteria/shared` que tienen ligeras discrepancias con el schema real.

**Razonamiento**: Arreglar los tipos compartidos es un change separado. Este change expone datos — corregir tipos es ortogonal.

## Schema DB → API mapping

### Calls
| DB Column | API Response |
|-----------|-------------|
| calls.id | id |
| calls.status | status |
| calls.startedAt | startedAt |
| calls.endedAt | endedAt |
| calls.duration | duration |
| kiosks.name (join) | kioskName |
| users.name (join) | operatorName |
| access_points.name (join) | accessPointName |

### Events
| DB Column | API Response |
|-----------|-------------|
| events.id | id |
| events.eventType | eventType |
| events.actorRole | actorRole |
| events.metadata | metadata |
| events.createdAt | createdAt |
| users.name (join on actorId) | actorName |

### Kiosks
| DB Column | API Response |
|-----------|-------------|
| kiosks.id | id |
| kiosks.name | name |
| kiosks.status | status |
| kiosks.lastHeartbeat | lastHeartbeat |
| access_points.name (join) | accessPointName |
| locations.name (join via access_points) | locationName |

## Risks / Trade-offs

- **[Trade-off] `createDb()` por servicio** → Cada servicio crea su propia pool de conexiones. En producción esto no escala bien. Pero es el patrón existente y cambiarlo requiere un change separado.
- **[Riesgo] Sin writes** → Los endpoints son read-only. Las calls no se persisten desde el signaling server todavía. Esto se aborda en un change futuro (`persist-calls-from-signaling`).
- **[Trade-off] Sin filtros avanzados** → Solo filtros básicos (status, fecha, eventType). Filtros complejos (rango de duración, búsqueda por operador) quedan para después.
