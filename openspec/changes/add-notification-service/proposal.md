## Why

La plataforma necesita avisar cosas en tiempo real y de forma confiable: ingreso/salida
de visitas, vehículos, alerta de salida faltante, pánico, llamada perdida, paquete
recibido, comunicados y tickets. Hoy no existe infraestructura de notificaciones: cada
módulo tendría que inventar su propio canal. Se necesita un servicio único con push
(Expo/FCM/APNs/WebPush), in-app, preferencias, deduplicación y entrega asíncrona
confiable.

## What Changes

- Crear `notifications` para el centro in-app y el historial por usuario.
- Crear `notification_preferences` por usuario/comunidad/tipo/canal, con horarios de
  silencio.
- Crear `push_devices` para tokens de dispositivos, incluyendo **Expo**.
- Implementar un **servicio de notificaciones** con plantillas i18n y selección de
  canal.
- Entregar de forma asíncrona usando la **outbox** (`notification.requested`).
- Entregar in-app en tiempo real por Socket.io (rooms por usuario).
- Implementar adaptadores **`PushProvider`** intercambiables: WebPush, FCM, APNs y
  **Expo Push**.
- Enrutar por **`topic`** del outbox: el worker principal consume `events`; el worker de
  notificaciones consume `notifications`.
- Agregar notificaciones de pases:
  - ingreso y salida al residente;
  - rechazo de ingreso;
  - salida faltante a residente, guardia y `community_admin`;
  - ingreso de vehículo con placa.
- Deduplicar, aplicar rate limits y limpiar tokens inválidos.
- **Non-goals:** no email/SMS en esta fase (la interfaz queda preparada), ni campañas
  masivas, ni constructor visual de plantillas.

## Capabilities

### New Capabilities

- `notification-service`: creación, plantillas, canales, deduplicación, horarios de
  silencio, entrega in-app/push y estado.
- `notification-preferences`: preferencias por usuario/comunidad/tipo/canal.
- `push-device-registry`: alta/baja de tokens de dispositivo, incluido Expo, y limpieza
  de inválidos.
- `pass-notifications`: ingreso, salida, rechazo, salida faltante y vehículo.

### Modified Capabilities

- `database-schema`: nuevas tablas `notifications`, `notification_preferences`,
  `push_devices`.
- `shared-types`: tipos/enums de notificación, canal, estado, plataforma y preferencias.

## Impact

- **Database**: `packages/database/src/schema/notification-*.ts`, migración.
- **API**: `server/api/src/modules/notifications/*`, worker de entrega por `topic`.
- **Shared**: tipos/DTOs de notificaciones.
- **Realtime**: entrega in-app por Socket.io.
- **App móvil**: registra el Expo Push Token.
- **Depende de**: `establish-domain-foundation`, `add-reliable-event-outbox`.
- **Consume eventos de**: `add-dynamic-qr-access` (`notification.requested` con
  `topic = 'notifications'`).
