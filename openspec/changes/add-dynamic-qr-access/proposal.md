## Why

El flujo de QR anterior asumía terminales, offline y un motor de acceso genérico. El
producto real necesita otra cosa: el residente crea un permiso desde la app, comparte un
**link dinámico**, el visitante lo abre en su teléfono y muestra un **QR que rota cada
24 segundos**. El link queda atado a un único dispositivo y el QR se consume al
escanearlo. El guardia, desde la misma app, escanea, ve si la persona está autorizada y
confirma o rechaza. No hay terminal físico, biometría ni apertura automática de puertas.

## What Changes

- Crear `access_passes` con:
  - visitante: nombre, apellido, cédula;
  - vehículo opcional: `has_vehicle` + `vehicle_plate`;
  - tipo: `entry_only`, `entry_exit`, `entry_exit_recurring`;
  - vigencia: desde/hasta, días permitidos y ventana diaria;
  - PIN opcional de 4 dígitos;
  - link token (hash), binding al primer dispositivo, estado y presencia.
- Crear `pass_scans` como bitácora de escaneos (entrada/salida/denegado) con nombre,
  apellido, cédula, placa, guardia y quién autorizó.
- Crear `pass_alerts` para salidas faltantes.
- Emitir un **link público** `/p/:token` (app `apps/pass-web`).
- Implementar **binding al primer dispositivo** con cookie firmada y PIN opcional.
- Emitir un **token QR firmado de 24 segundos**, de un solo uso (`jti`).
- Implementar **escaneo** desde la app del guardia y **Confirmar/Rechazar**.
- Implementar ciclos entrada/salida:
  - `entry_only`: se consume al confirmar la entrada;
  - `entry_exit`: una entrada y una salida;
  - `entry_exit_recurring`: ciclos repetidos por días/horario.
- Implementar **alerta de salida faltante** (gracia configurable, 15 min por defecto)
  con notificación a residente, guardia y `community_admin`.
- Agregar `outbox_events.topic` (`events` | `notifications`) y encolar
  `notification.requested` para el servicio de notificaciones.
- **Non-goals:** no biometría, no terminales físicos, no actuación de puertas, no modo
  offline, no motor genérico de reglas, no app nativa del guardia separada (el guardia
  usa `add-zima-qr-access-app`).

## Capabilities

### New Capabilities

- `dynamic-pass-creation`: creación de pases, tipos, horarios, vehículo, PIN, link,
  regeneración, revocación y límites.
- `pass-link-binding`: binding al primer dispositivo, cookie firmada, PIN opcional,
  estado y recuperación por pérdida de teléfono.
- `rotating-qr`: token QR de 24 s, un solo uso, QR público y QR del residente.
- `pass-scan-entry`: escaneo por guardia, validación, Confirmar/Rechazar, entrada/salida
  y bitácora.
- `pass-lifecycle`: estados, presencia, recurrencia, expiración, revocación y salida
  faltante.

### Modified Capabilities

- `database-schema`: `access_passes`, `pass_scans`, `pass_alerts` y
  `outbox_events.topic`.
- `shared-types`: tipos, enums y DTOs de pases/escaneos/alertas.
- `outbox-delivery`: el worker principal entrega solo `topic = 'events'`; el worker de
  notificaciones consume `topic = 'notifications'`.

## Impact

- **Database**: `packages/database/src/schema/access-passes.ts`, `pass-scans.ts`,
  `pass-alerts.ts`, `outbox-events.ts` (topic), migración.
- **API**: `server/api/src/modules/passes/*`, `server/api/src/modules/access/scan/*`,
  worker de alertas, emisión de eventos por outbox.
- **Shared**: `packages/shared/src/{types,dto,enums}`.
- **Web pública**: nueva app `apps/pass-web` para `/p/:token`.
- **Notificaciones**: encola `notification.requested` (topic notifications) para
  `add-notification-service`.
- **Depende de**: `establish-domain-foundation`, `add-tenant-entry-and-platform-console`
  y `add-reliable-event-outbox` (archivados).
- **No depende de**: `add-access-control-engine`, `add-biometric-access`,
  `add-device-abstraction` (parkeados).
