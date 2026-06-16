## 1. Database Schema

- [x] 1.1 Create `packages/database/src/schema/relay-outputs.ts` with Drizzle table definition and `relayModeEnum` pgEnum
- [x] 1.2 Add `relayOutputsRelations` in `relations.ts` (relay_outputs → kiosks FK, relay_outputs → access_points FK)
- [x] 1.3 Export `relayOutputs` and `relayModeEnum` from `schema/index.ts` and relations from `relations.ts`
- [x] 1.4 Update `seed.ts` with 4 relay_outputs linked to demo kiosk (`rpiId = 'rpi-demo-001'`)

## 2. Shared DTOs

- [x] 2.1 Create `packages/shared/src/dto/relays.ts` with `TriggerRelayDto` and `RelayConfigDto` interfaces
- [x] 2.2 Export new DTOs from `packages/shared/src/index.ts`

## 3. API: Relay Service

- [x] 3.1 Create `server/api/src/services/relays.service.ts`
- [x] 3.2 Implement `getRelaysByKioskId(kioskId)` — returns all relay_outputs for a kiosk
- [x] 3.3 Implement `getRelayForAccessPoint(kioskId, accessPointId)` — returns relay linked to an access point
- [x] 3.4 Implement `getRelayByIndex(kioskId, relayIndex)` — returns relay by index
- [x] 3.5 Service uses `createDb()` from `@porteria/database` (same pattern as calls.service.ts)

## 4. API: Schemas + Config

- [x] 4.1 Add `triggerRelaySchema` Zod schema in `server/api/src/schemas/index.ts`
- [x] 4.2 Add `MQTT_BRIDGE_URL` to `server/api/src/config.ts` (default `http://localhost:3002`)

## 5. API: Routes

- [x] 5.1 Create `server/api/src/routes/relays.routes.ts` with `relaysRoutes` (authenticated) and `internalRelayRoutes` (API key)
- [x] 5.2 `GET /api/kiosks/:kioskId/relays` — authenticated (JWT), calls `getRelaysByKioskId()`, returns `RelayConfigDto[]`
- [x] 5.3 `POST /api/internal/relays/trigger` — API key auth, validates with Zod, looks up relay by `kioskId` + (`relayIndex` or `accessPointId`), calls MQTT bridge via `fetch()`, returns `{ ok, requestId }`
- [x] 5.4 Register both route plugins in `server/api/src/index.ts`

## 6. MQTT Bridge: Core

- [x] 6.1 Initialize MQTT client (`mqtt.js`) connecting to `MQTT_HOST:MQTT_PORT` from env (default `localhost:1883`)
- [x] 6.2 Track MQTT connection state in a variable for `/health` reporting
- [x] 6.3 Handle MQTT reconnection with exponential backoff
- [x] 6.4 Implement `publishRelayCommand(buildingId, relayIndex, payload)` helper

## 7. MQTT Bridge: REST API

- [x] 7.1 `POST /relays/trigger` — validates body, calls `publishRelayCommand()`, returns `{ ok: true, requestId }`
- [x] 7.2 Add input validation for trigger body (buildingId, relayIndex, state required)
- [x] 7.3 Update `GET /health` to include `mqtt` connection state

## 8. MQTT Bridge: Socket.io Status Push

- [x] 8.1 Add Socket.io server to mqtt-bridge on the same HTTP server
- [x] 8.2 Subscribe to MQTT topic `porteria/+/relay/+/status` on startup
- [x] 8.3 Parse buildingId and relayIndex from topic wildcards, forward as `relay:status` event to 'operators' room
- [x] 8.4 Operators join 'operators' room on Socket.io connect

## 9. Signaling Server

- [x] 9.1 Add `relay:trigger` to `ClientToServerEvents` in `types.ts` (`{ buildingId: string; relayIndex: number }`)
- [x] 9.2 Modify `door:open` handler in `operator.ts`: after emitting to kiosk, add fire-and-forget `fetch()` to `POST /api/internal/relays/trigger` with kiosk's relay info
- [x] 9.3 Add `relay:trigger` handler in `operator.ts`: validate operator, fire-and-forget `fetch()` to API internal endpoint
- [x] 9.4 All persistence calls use same fire-and-forget + `.catch()` logging pattern as `persist.ts`

## 10. Dashboard: Relay Buttons

- [x] 10.1 On active call start, fetch `GET /api/kiosks/{kioskId}/relays` with JWT to get relay configs
- [x] 10.2 Render relay buttons in VideoPanel below existing controls (exclude relay linked to access_point)
- [x] 10.3 Momentary button: on click, emit `relay:trigger` via signaling socket, show visual pulse feedback for duration
- [x] 10.4 Latch button: render with ON/OFF state indicator, emit `relay:trigger` on click, toggle state on `relay:status` event
- [x] 10.5 Connect to MQTT bridge Socket.io to receive `relay:status` events
- [x] 10.6 Add CSS for relay buttons in `App.css`

## 11. RPi Daemon (Python)

- [x] 11.1 Create `RPi/relay-daemon/relay-daemon.py` with paho-mqtt and gpiozero
- [x] 11.2 Read config from `config.yaml` (MQTT host, port, building_id, relay GPIO pins)
- [x] 11.3 Subscribe to `porteria/+/relay/+/set` topic wildcard
- [x] 11.4 On message: parse relayIndex from topic, execute ON/OFF/TOGGLE on GPIO via gpiozero
- [x] 11.5 On momentary ON: start threading.Timer for duration_ms, then OFF
- [x] 11.6 After any state change, publish status to `porteria/{buildingId}/relay/{index}/status`
- [x] 11.7 On startup, read current GPIO states and publish initial status
- [x] 11.8 SIGTERM handler: GPIO cleanup (gpiozero handles this automatically with close())
- [x] 11.9 Create systemd unit file `RPi/relay-daemon/porteria-relay.service`

## 12. Verification

- [x] 12.1 Verify MQTT bridge connects to Mosquitto and `/health` reports connection state
- [x] 12.2 Verify `POST /relays/trigger` publishes correct MQTT message (use mosquitto_sub to observe)
- [x] 12.3 Verify end-to-end: operator click → MQTT message published → Python daemon receives it
- [x] 12.4 Verify door open button triggers correct relay via API internal endpoint
- [x] 12.5 Verify latch mode state feedback in dashboard UI
- [x] 12.6 Verify dashboard gracefully handles MQTT bridge being down (relay buttons still render, trigger fails silently)
