## Why

El sistema registra llamadas y eventos en PostgreSQL pero no ofrece reportes agregados ni una bitácora consultable desde el dashboard. Los endpoints `/api/events` y `/api/calls` devuelven datos crudos paginados, pero no hay agregación diaria/semanal/mensual, no se aprovechan las capacidades time-series de TimescaleDB, y el frontend solo tiene un EventLog rudimentario en tiempo real vía Socket.io. Sin esto, no hay auditoría real, no hay tendencias, y el operador/admin no puede responder preguntas básicas como "¿cuántas puertas se abrieron esta semana?".

## What Changes

- **Nuevos endpoints de reportes agregados**: `GET /api/reports/daily`, `/api/reports/weekly`, `/api/reports/monthly`, `/api/reports/call-stats`, `/api/reports/event-breakdown` con queries que usan `time_bucket()` de TimescaleDB
- **Ampliación de inserción de eventos**: `insertEvent()` se llama desde door open, user login/logout, cambios de estado de kiosk, creación/edición de usuarios
- **Frontend de bitácora digital**: Vista completa con tabla paginada, filtros por tipo de evento, rango de fechas, actor, access point, usando los endpoints existentes `/api/events`
- **Frontend de reportes**: Panel de reportes en el dashboard admin con selectores de período, gráficos de tendencias (barras/líneas), tablas de resumen
- **Nuevos DTOs en shared**: Tipos para `DailyReport`, `WeeklyReport`, `MonthlyReport`, `CallStats`, `EventTimeSeries`

## Capabilities

### New Capabilities

- `reports-api`: Endpoints de reportes agregados diario/semanal/mensual, métricas de llamadas, y breakdown de eventos por bucket temporal usando TimescaleDB time_bucket()
- `reports-ui`: Panel de reportes en dashboard admin (gráficos, selectores de período, tablas de resumen) y vista completa de bitácora con filtros y paginación
- `event-audit`: Ampliación de tipos de eventos registrados (door.open, user.login/logout, kiosk.online/offline, user.created/updated) desde los distintos módulos del sistema

### Modified Capabilities

- `event-log-api`: Agregar soporte para filtrado por actor y access point, nuevos tipos de eventos documentados
- `dashboard-stats-api`: Extender para aceptar rango de fechas opcional (no solo día actual)
- `shared-types`: Agregar DTOs de reportes (DailyReport, WeeklyReport, MonthlyReport, CallStats, EventTimeSeries)

## Impact

- **Backend**: Nuevo `server/api/src/routes/reports.routes.ts` + `server/api/src/services/reports.service.ts`, ampliación de `events.service.ts`
- **Frontend**: Nuevos componentes `ReportsPanel.tsx`, `BitacoraView.tsx`, `ReportChart.tsx` en dashboard admin; reemplazo de `EventLog.tsx` actual
- **Shared**: Nuevo `packages/shared/src/dto/reports.ts` y `packages/shared/src/types/reports.ts`
- **Dependencias**: Se evaluará Recharts o similar para gráficos en el frontend
