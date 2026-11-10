## Why

El flujo de QR anterior asumía terminales, offline y un motor de acceso genérico. El
producto real necesita otra cosa: el residente crea un permiso desde la app, comparte un
**link dinámico**, el visitante lo abre en su teléfono y muestra un **QR que rota cada
24 segundos**. El link queda atado a un único dispositivo y el QR se consume al
escanearlo. El guardia, desde la misma app, escanea, ve si la persona está autorizada y
confirma o rechaza. No hay terminal físico, biometría ni apertura automática de puertas.

Este change implementa el **MVP** y deja el schema y los contratos preparados para las
adiciones de Phase 2 (push, subusuarios, recurrentes y alertas) sin migraciones
destructivas.

## What Changes

- Crear `access_passes` con:
  - ubicación: `location_unit_id` (hoja), `structure_id`, `created_by_person_id` y
    `authorized_by_person_id`;
  - visitante: nombre, apellido, cédula;
  - vehículo opcional: `has_vehicle` + `vehicle_plate`;
  - tipo: `entry_only` y `entry_exit`; `entry_exit_recurring` queda reservado en el enum;
  - vigencia: desde/hasta y ventana diaria; `allowed_days` queda reservado para Phase 2;
  - PIN opcional de 4 dígitos con lockout;
  - link token (hash), expiración del link, binding al primer dispositivo, estado y
    presencia;
  - `authorized_by_delegation_id` nullable y sin FK, reservado para Phase 2.
- Crear `pass_scans` como bitácora de escaneos con `guard_person_id`,
  `guard_account_id`, camino de ubicación, nombre, apellido, cédula, placa y autorizador.
- Crear `pass_alerts` vacía, reservada para la alerta de salida faltante de Phase 2.
- Emitir un **link público** `/p/:token` (app `apps/pass-web`, same-site).
- Implementar **binding al primer dispositivo** con cookie `pass_device` y PIN opcional.
- Emitir un **token QR JWT HS256 de 24 segundos**, de un solo uso (`jti`).
- Implementar **escaneo** desde la app del guardia y **Confirmar/Rechazar**, con TTL de
  scans pendientes.
- Implementar ciclos `entry_only` y `entry_exit`.
- Agregar `outbox_events.topic` (default `events`) y hacer que el worker principal
  entregue solo `topic = 'events'`.
- **Phase 2 (fuera del MVP):** notificaciones push, subusuarios/delegaciones, pases
  recurrentes, worker de salida faltante, bitácora en el dashboard y flag por comunidad.
- **Non-goals:** no biometría, no terminales físicos, no actuación de puertas, no modo
  offline, no motor genérico de reglas, no app nativa del guardia separada (el guardia
  usa `add-zima-qr-access-app`).

## Capabilities

### New Capabilities

- `dynamic-pass-creation`: creación de pases, tipos MVP, horarios, vehículo, PIN, link,
  regeneración, revocación y límites.
- `pass-link-binding`: binding al primer dispositivo, cookie firmada, PIN opcional,
  expiración del link, estado y recuperación por pérdida de teléfono.
- `rotating-qr`: token QR JWT de 24 s, un solo uso, QR público y QR del residente.
- `pass-scan-entry`: escaneo por guardia/operador, validación, Confirmar/Rechazar,
  entrada/salida y bitácora.
- `pass-lifecycle`: estados, presencia, expiración y revocación. Recurrencia y salida
  faltante quedan especificadas para Phase 2.

### Modified Capabilities

- `database-schema`: `access_passes`, `pass_scans`, `pass_alerts` y
  `outbox_events.topic`.
- `shared-types`: tipos, enums y DTOs de pases/escaneos/alertas.
- `outbox-delivery`: el worker principal entrega solo `topic = 'events'`; el worker de
  notificaciones queda para Phase 2.

## Impact

- **Database**: `packages/database/src/schema/access-passes.ts`, `pass-scans.ts`,
  `pass-alerts.ts`, `outbox-events.ts` (topic), migración.
- **API**: `server/api/src/services/pass.service.ts`, `public-pass.service.ts`,
  `access-scan.service.ts`; `server/api/src/routes/{pass,public-pass,access}.routes.ts`;
  emisión de eventos por outbox.
- **Shared**: `packages/shared/src/{types,dto,enums}`.
- **Web pública**: nueva app `apps/pass-web` para `/p/:token`.
- **Depende de**: `establish-domain-foundation`, `add-tenant-entry-and-platform-console`,
  `add-reliable-event-outbox` (archivados), `add-configurable-location-hierarchy`,
  `separate-people-and-accounts` y `align-memberships-with-location-units` (completos).
- **No depende de**: `add-access-control-engine`, `add-biometric-access`,
  `add-device-abstraction` (parkeados).
- **Phase 2 depende de**: `add-notification-service` y `add-delegated-subusers`.
