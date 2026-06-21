## Why

El ciclo de vida completo de llamadas (request → accept → end → timeout) funciona perfectamente en el signaling server, pero es 100% efímero: todo vive en memoria y se pierde al reiniciar. Las tablas `calls` y `events` existen en PostgreSQL, los endpoints `GET /api/calls` y `GET /api/events` están implementados, pero siempre devuelven vacío porque **nadie escribe**. No hay historial, no hay auditoría, no hay estadísticas reales.

Además, el panel de admin solo muestra gestión de usuarios — no hay vista de historial de llamadas. El operador tiene un EventLog en memoria que se pierde al refrescar.

## What Changes

- **API Server — endpoints internos de escritura**: `POST /api/internal/calls` para crear un registro cuando el kiosk inicia una llamada. `PATCH /api/internal/calls/:callId` para actualizar estado cuando se acepta, termina, o expira. Protegidos con API key interna.
- **API Server — `calls.service.ts`**: Nuevas funciones `createCall()` y `updateCall()` con resolución de IDs (buildingId → kioskId → organizationId vía JOINs).
- **API Server — `events.service.ts`**: Nuevo servicio para insertar eventos (`call.started`, `call.ended`, `call.missed`) en la tabla `events`.
- **Signaling Server — HTTP calls al API**: Al recibir `call:request` → `POST /api/internal/calls`. Al recibir `call:accept` → `PATCH` con operatorId y status. Al recibir `call:end` o timeout → `PATCH` con status, endedAt, duration. Usa `fetch()` nativo de Node 22.
- **Dashboard Admin — `CallHistoryTable`**: Nuevo componente con tabla paginada de llamadas, filtros por status y rango de fechas. Se integra en `AdminPanel`.
- **Dashboard Operator — historial personal**: Sección "Mis llamadas" en `OperatorPanel` que muestra las últimas 50 llamadas del operador (filtrado por `operatorId`).
- **Shared DTOs**: `CreateCallDto`, `UpdateCallDto` en `packages/shared/src/dto/calls.ts`.
- **Filtro `operatorId` en `GET /api/calls`**: Parámetro opcional. Si el usuario es operador, se fuerza a su propio ID (seguridad). Si es admin, puede filtrar por cualquier operador.

## Capabilities

### Modified Capabilities
- `call-history-api`: Se agrega el write side (internal endpoints) y el filtro `operatorId` en el endpoint de lectura.
- `signaling-server`: El servidor de señalización ahora persiste llamadas en la DB vía HTTP interno al API server.
- `dashboard-admin`: AdminPanel incluye `CallHistoryTable` con historial completo de llamadas.
- `event-log-api`: Se agrega `events.service.ts` con inserción de eventos de llamada.

### New Capabilities
- `operator-call-history`: El operador puede ver su historial personal de llamadas atendidas.

## Impact

**API Server:**
- `server/api/src/routes/calls.routes.ts`: +3 internal endpoints (POST/PATCH)
- `server/api/src/services/calls.service.ts`: +createCall, updateCall, +operatorId filter
- `server/api/src/services/events.service.ts`: NUEVO — insertEvent
- `server/api/src/config.ts`: +internalApiKey

**Signaling Server:**
- `server/signaling/src/handlers/kiosk.ts`: +POST internal call on call:request
- `server/signaling/src/handlers/operator.ts`: +PATCH internal call on call:accept
- `server/signaling/src/handlers/call.ts`: +PATCH internal call on call:end
- `server/signaling/src/config.ts`: +apiBaseUrl, apiKey

**Shared:**
- `packages/shared/src/dto/calls.ts`: NUEVO — CreateCallDto, UpdateCallDto

**Dashboard:**
- `apps/dashboard/src/components/admin/CallHistoryTable.tsx`: NUEVO — tabla paginada con filtros
- `apps/dashboard/src/components/admin/AdminPanel.tsx`: Integrar CallHistoryTable
- `apps/dashboard/src/components/operator/OperatorPanel.tsx`: Sección "Mis llamadas"

CERO cambios en: DB schema, kiosk app, WebRTC, seed data.
