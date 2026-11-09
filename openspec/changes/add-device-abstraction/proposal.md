## Why

El control de acceso actual está acoplado al kiosco y a `relay_outputs`: la apertura se
hace por un endpoint de relés con `buildingId = kioskId`. Eso no escala a lectores
faciales, lectores QR, torniquetes, barreras, placas de relés o citófonos de distintos
fabricantes. Se necesita una capa de **dispositivos genéricos** con comandos
idempotentes, confirmación, reintentos y un agente edge que opere offline.

## What Changes

- Crear `devices`: dispositivo de una comunidad, opcionalmente asociado a un punto de
  acceso, con tipo, driver, identificador, credencial, capacidades y estado.
- Crear `device_commands` como **outbox de comandos**: `pending`, `sent`, `acked`,
  `failed`, `expired`, con `requestId` idempotente.
- Definir la interfaz **`DeviceDriver`** (`open`, `close`, `status`, `identify`,
  `reboot`) y adaptadores por tipo.
- Estandarizar **tópicos MQTT** por comunidad/dispositivo con ack y estado.
- Implementar **provisioning y autenticación por dispositivo**.
- Migrar `kiosks`/`relay_outputs` a `devices` manteniendo compatibilidad.
- Definir el **edge agent**: cachea política, ejecuta comandos y encola logs.
- **Non-goals:** no se implementa firmware, ni actualización OTA, ni drivers de
  fabricantes específicos en esta fase (solo el contrato y los adaptadores base).

## Capabilities

### New Capabilities

- `device-registry`: registro, tipos, provisioning, estado y capacidades.
- `device-command-outbox`: ciclo de vida de comandos, idempotencia, ack, reintentos y
  timeout.
- `hardware-adapters`: interfaz `DeviceDriver` y convenciones MQTT.
- `edge-agent`: cache offline, ejecución local y cola de logs.

### Modified Capabilities

- `database-schema`: nuevas tablas `devices` y `device_commands`, y migración de
  `relay_outputs`.
- `shared-types`: tipos/enums de dispositivos, drivers y comandos.
- `mqtt-bridge`: tópicos genéricos por dispositivo además de los de relé.

## Impact

- **Database**: `packages/database/src/schema/devices.ts`,
  `device-commands.ts`, migración.
- **API**: `server/api/src/modules/devices/*`.
- **MQTT Bridge**: `server/mqtt-bridge/src/index.ts` (tópicos y ack).
- **Signaling/Dispositivos**: el motor de acceso emite comandos por `device_commands`.
- **Depende de**: `add-access-control-engine`.
