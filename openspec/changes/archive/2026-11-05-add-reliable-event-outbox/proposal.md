## Why

Hoy la persistencia de eventos desde signaling y otros módulos es
**fire-and-forget por HTTP** (`persistEvent(...).catch(() => {})`). Si el API está
caído, el evento se pierde: no hay auditoría confiable, ni bitácora completa, ni
métricas correctas. Con control de acceso, pánico y finanzas en camino, perder eventos
deja de ser aceptable. Se necesita entrega **at-least-once** con idempotencia.

## What Changes

- Crear una tabla **`outbox_events`** transaccional.
- Escribir el evento en la **misma transacción** que el cambio de dominio.
- Implementar un **worker de entrega** con `FOR UPDATE SKIP LOCKED`, reintentos con
  backoff exponencial, jitter y **dead-letter**.
- Hacer **idempotente** la ingesta en `/api/internal/events` mediante `event_id` único.
- Migrar la persistencia de signaling de HTTP fire-and-forget a escritura directa en
  la outbox (agregando `@porteria/database` a signaling).
- Exponer **métricas de outbox** (pendientes, lag, fallidos, dead-letter) y un endpoint
  de replay para administradores.
- **Non-goals:** no se implementa CDC/Debezium, ni un bus externo (Kafka/NATS), ni
  exactly-once. La entrega es at-least-once con consumidores idempotentes.

## Capabilities

### New Capabilities

- `event-outbox`: tabla, envelope de evento, escritura transaccional y unicidad.
- `outbox-delivery`: worker de entrega, reintentos, dead-letter, idempotencia y replay.

### Modified Capabilities

- `database-schema`: nueva tabla `outbox_events` con índices.
- `shared-types`: envelope de evento y estados de outbox.
- `event-log-api`: ingesta interna idempotente por `eventId`.

## Impact

- **Database**: `packages/database/src/schema/outbox-events.ts`, migración 0006.
- **API**: worker en `server/api/src/workers/outbox.worker.ts`, ingesta idempotente en
  `events.service.ts`, endpoint de replay.
- **Signaling**: agrega `@porteria/database` y escribe en `outbox_events` en lugar de
  llamar al API; `persist.ts` cambia.
- **Shared**: `EventEnvelope`, `OutboxStatus`.
- **Depende de**: `establish-domain-foundation` (community/organization).
