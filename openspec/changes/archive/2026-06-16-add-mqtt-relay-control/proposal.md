## Why

El sistema de portería virtual necesita activar relés físicos (cerraduras, portones, luces, alarmas) desde el dashboard del operador. Actualmente el botón "Abrir puerta" solo emite un evento Socket.io que muestra una animación en el kiosk — ningún relé físico se activa. El `door:open` handler en signaling y operator solo forwardea el evento al kiosk para UI, pero no hay integración con GPIO.

La Fase 4 del roadmap ("MQTT + GPIO + Guard Rondas digitales") requiere esta infraestructura. El stack ya tiene Mosquitto corriendo en Docker (puertos 1883/9001), el `mqtt-bridge` como scaffold Fastify en puerto 3002, y la tabla `access_points` con columna `gpio_pin`. El change `add-call-persistence` estableció el patrón Signaling → API internal endpoint → DB que este cambio sigue.

Se necesitan 4 relés por RPi4, cada uno configurable como momentáneo (ON por X segundos) o latch (toggle ON/OFF). Un relé se asigna al botón "Abrir puerta" (vía `access_point_id` link). Los otros 3 tienen botones extra en la UI del operador.

## What Changes

- **Schema**: Nueva tabla `relay_outputs` con GPIO pin, modo (`momentary` | `latch`), duración, y link opcional al `access_point` para el botón de puerta. Relaciones con `kiosks` y `access_points`.
- **Shared DTOs**: `TriggerRelayDto` y `RelayConfigDto` en `packages/shared/src/dto/relays.ts`.
- **API Server**: `relays.service.ts` con lookup de relay por kiosk y por access point. Zod schema para trigger. `GET /api/kiosks/:kioskId/relays` (autenticado) y `POST /api/internal/relays/trigger` (API key, mismo patrón que internal calls).
- **MQTT Bridge**: De skeleton a funcional — cliente MQTT, endpoint `POST /relays/trigger` que publica en `porteria/{buildingId}/relay/{index}/set`, suscriptor de status, Socket.io server para forwardear `relay:status` al dashboard.
- **Signaling Server**: `door:open` handler ahora también dispara el relé físico vía API internal. Nuevo evento `relay:trigger` para botones extra. Sigue el mismo patrón fire-and-forget de `persist.ts`.
- **Dashboard UI**: VideoPanel muestra botones de relé extra con feedback visual (momentary muestra pulso, latch muestra toggle ON/OFF). Se conecta al Socket.io del mqtt-bridge para status en tiempo real.
- **RPi Daemon**: Script Python con gpiozero + paho-mqtt que suscribe MQTT, controla GPIO, publica status de vuelta. Corre como systemd service.

## Capabilities

### New Capabilities
- `relay-control`: Sistema de control de relés — definición de `relay_outputs` en DB, modos momentary/latch, activación vía REST, feedback de estado en tiempo real.
- `mqtt-bridge`: Puente MQTT funcional con publicación de comandos, suscripción de status, y Socket.io para push al dashboard.

### Modified Capabilities
- `signaling-server`: `door:open` ahora dispara relé físico vía API internal. Nuevo evento `relay:trigger` y su handler.
- `dashboard-operator`: VideoPanel con botones de relé extra y feedback visual de estado.
- `database-schema`: Nueva tabla `relay_outputs` con enum `relay_mode` y relaciones.
- `seed-data`: Seed incluye 4 `relay_outputs` para el kiosk demo (`rpi-demo-001`).

## Impact

- `packages/database/src/schema/relay-outputs.ts`: Nueva tabla Drizzle (~20 líneas)
- `packages/database/src/schema/relations.ts`: +relaciones relay_outputs → kiosks, access_points (~15 líneas)
- `packages/database/src/schema/index.ts`: +1 export (~3 líneas)
- `packages/database/src/seed.ts`: +4 relay_outputs (~25 líneas)
- `packages/shared/src/dto/relays.ts`: Nuevo — TriggerRelayDto, RelayConfigDto (~15 líneas)
- `packages/shared/src/index.ts`: +1 export (~2 líneas)
- `server/api/src/services/relays.service.ts`: Nuevo (~50 líneas)
- `server/api/src/schemas/index.ts`: +triggerRelaySchema (~10 líneas)
- `server/api/src/routes/relays.routes.ts`: Nuevo (~45 líneas)
- `server/api/src/index.ts`: +2 route registrations (~4 líneas)
- `server/api/src/config.ts`: +MQTT_BRIDGE_URL (~2 líneas)
- `server/mqtt-bridge/src/`: MQTT client + REST + Socket.io (~150 líneas)
- `server/signaling/src/handlers/operator.ts`: Modificar door:open + relay:trigger (~20 líneas)
- `server/signaling/src/types.ts`: +relay:trigger en ClientToServerEvents (~5 líneas)
- `apps/dashboard/src/components/operator/VideoPanel.tsx`: Relay buttons (~50 líneas)
- `apps/dashboard/src/App.css`: Estilos relay buttons (~20 líneas)
- `RPi/relay-daemon/`: Script Python fuera del monorepo (~80 líneas)
