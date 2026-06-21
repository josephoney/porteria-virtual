## Context

El sistema ya persiste llamadas y eventos en PostgreSQL+TimescaleDB. Los endpoints `GET /api/events` y `GET /api/calls` devuelven datos crudos paginados. La tabla `events` es una hypertable de TimescaleDB con chunks de 7 días e índices por `(organization_id, created_at DESC)` y `(organization_id, event_type, created_at DESC)`. Sin embargo, no hay agregación temporal ni reportes. El frontend tiene un `EventLog.tsx` que muestra eventos en tiempo real vía Socket.io pero sin conexión a la API REST, sin paginación ni filtros.

Los tipos de eventos actualmente registrados son limitados: solo `call.started`, `call.ended` y `call.missed` desde `calls.service.ts`. Faltan eventos de puerta, autenticación, kiosks y usuarios.

## Goals / Non-Goals

**Goals:**
- Endpoints de reportes agregados diario/semanal/mensual usando `time_bucket()` de TimescaleDB
- Métricas de llamadas: tasa de atención, duración promedio, distribución por hora/kiosk
- Ampliar `insertEvent()` para registrar door.open, user.login/logout, kiosk.online/offline, user.created/updated
- Vista completa de bitácora en dashboard admin con filtros, paginación y detalle expandible
- Panel de reportes en dashboard admin con gráficos de tendencias y tablas de resumen
- Nuevos DTOs compartidos para reportes en `@porteria/shared`

**Non-Goals:**
- Exportación CSV/PDF (se puede agregar en fase posterior)
- Reportes personalizados (query builder)
- Alertas o notificaciones basadas en eventos
- Retención/purgado de eventos (ya manejado por TimescaleDB chunks)
- App residente (fase 5)

## Decisions

### 1. Reports service con Drizzle raw SQL para time_bucket()

**Decisión**: Crear `server/api/src/services/reports.service.ts` usando `db.execute(sql\`...\`)` de Drizzle para queries con `time_bucket()`, ya que Drizzle no tiene soporte nativo para funciones TimescaleDB.

**Alternativa considerada**: Usar el query builder de Drizzle con `sql\`time_bucket(...)\`` embebido. Se descartó porque el query builder agrega complejidad innecesaria para queries analíticas que son inherentemente SQL crudo.

### 2. Recharts para gráficos en frontend

**Decisión**: Usar Recharts (v2) como librería de gráficos. Es la más popular en el ecosistema React, liviana (~140KB), con componentes declarativos que encajan con el estilo del proyecto.

**Alternativas consideradas**:
- Chart.js + react-chartjs-2: más pesado, API menos React-idiomática
- Nivo: más features pero más compleja y pesada
- Visx: muy flexible pero requiere más código para casos simples

### 3. insertEvent() desde múltiples módulos

**Decisión**: Agregar llamadas a `insertEvent()` en:
- **Signaling server** (`handlers/operator.ts`): evento `door.open` al emitir `door:open`
- **API server** (`routes/auth.routes.ts`): eventos `user.login` y `user.logout`
- **Signaling server** (`handlers/kiosk.ts`): eventos `kiosk.online` y `kiosk.offline` en register/disconnect
- **API server** (`routes/users.routes.ts`): eventos `user.created` y `user.updated`

Cada módulo usa `fetch()` internamente a `POST /api/internal/events` (nuevo endpoint interno, mismo patrón que `/api/internal/calls`).

**Alternativa considerada**: Emitir eventos por Socket.io y que el signaling persista. Se descartó porque acopla innecesariamente y duplica lógica — mejor un endpoint interno simple como ya se hizo con calls.

### 4. Endpoint interno para inserción de eventos

**Decisión**: Crear `POST /api/internal/events` con autenticación por `X-Internal-Key` (mismo patrón que `/api/internal/calls` y `/api/internal/relays/trigger`).

### 5. Bitácora: componente nuevo, no modificar EventLog existente

**Decisión**: Crear `BitacoraView.tsx` como componente nuevo en dashboard admin, consumiendo `GET /api/events`. El `EventLog.tsx` actual del operator panel se mantiene como está (eventos en tiempo real), pero se le agrega un link "Ver bitácora completa" que navega a la vista admin.

## Risks / Trade-offs

- **[Riesgo] Queries time_bucket() pueden ser pesadas en rangos largos** → Mitigación: Limitar rangos a 90 días máximo, usar los índices existentes de la hypertable, paginar resultados de breakdown
- **[Riesgo] Inserción de eventos por HTTP puede fallar** → Mitigación: Fire-and-forget con `.catch()` logging (mismo patrón que call persistence), los eventos son dato histórico no crítico para la operación en tiempo real
- **[Trade-off] Recharts vs nativo Canvas/SVG** → Recharts es suficiente para barras y líneas. Si en el futuro se necesitan visualizaciones más complejas (mapas de calor, timelines), se puede migrar a Visx sin cambiar la estructura del panel
- **[Trade-off] insertEvent() vía HTTP vs directo a DB** → Se eligió HTTP para mantener el API server como único punto de acceso a la DB, consistente con el patrón existente de calls y relays. Agrega latencia pero desacopla correctamente

## Open Questions

- ¿Formato de fecha para filtros? Se usará ISO 8601 consistente con los endpoints existentes (`?from=2026-06-01T00:00:00Z`)
- ¿Los reportes semanales usan numeración ISO 8601 (W24) o fecha del lunes? Se usará fecha del lunes como parámetro (`?week=2026-06-15` que es lunes)
