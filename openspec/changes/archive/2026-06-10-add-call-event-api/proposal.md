## Why

`server/api/` expone endpoints de auth y users CRUD, pero no hay forma de consultar el historial de llamadas, la bitácora de eventos, ni listar kiosks desde la API REST. El dashboard-admin consume la API para gestión de usuarios pero no puede mostrar datos de llamadas o eventos.

Los datos existen en la DB (schema completo de calls, events, kiosks, access_points) pero no hay servicios ni rutas que los expongan. El seed ya crea datos demo pero no hay endpoints para consultarlos.

Esto bloquea:
- Dashboard: mostrar historial de llamadas, bitácora de eventos
- Reportes: sin datos no hay reportes (Fase 3)
- Verificación end-to-end: no se puede validar que los datos del signaling lleguen a la API

## What Changes

- **Servicio de calls**: `GET /api/calls` (paginated, filtered by status/date), `GET /api/calls/:id` (detail with joined kiosk/operator names)
- **Servicio de events**: `GET /api/events` (paginated, filtered by event type/date range), `GET /api/events/stats` (counts by type for dashboard)
- **Servicio de kiosks**: `GET /api/kiosks` (list with status, access point, location)
- **Dashboard stats agregado**: `GET /api/dashboard/stats` (totales: kiosks, calls today, events today)
- **Zod schemas** para validación de query params (paginación, filtros)
- **RBAC**: calls y events accesibles a admin + operator; kiosks a admin + operator

## Capabilities

### New Capabilities
- `call-history-api`: Endpoints paginados de historial de llamadas con filtros por estado y fecha, detalle con nombres de kiosk/operador vía joins.
- `event-log-api`: Endpoints paginados de bitácora de eventos con filtros por tipo de evento y rango de fechas, estadísticas agregadas por tipo.
- `kiosk-management-api`: Listado de kiosks registrados en la DB con su estado, punto de acceso y ubicación.
- `dashboard-stats-api`: Endpoint agregado de estadísticas para el dashboard (totales de kiosks, llamadas del día, eventos del día).

### Modified Capabilities
- Ninguno — se agregan rutas nuevas sin modificar las existentes.

## Impact

- **`server/api/src/routes/`**: 3 nuevos archivos (`calls.routes.ts`, `events.routes.ts`, `kiosks.routes.ts`)
- **`server/api/src/services/`**: 3 nuevos archivos (`calls.service.ts`, `events.service.ts`, `kiosks.service.ts`)
- **`server/api/src/schemas/`**: Se agregan schemas de query params para calls y events
- **`server/api/src/index.ts`**: Se registran 3 nuevos prefijos de rutas (`/api/calls`, `/api/events`, `/api/kiosks`)
- **No breaking changes**: Las rutas existentes de auth y users no se tocan
