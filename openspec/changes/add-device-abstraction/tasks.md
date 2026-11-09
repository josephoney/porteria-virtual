## 1. Shared types

- [ ] 1.1 Add `DeviceType`, `DeviceStatus`, `DeviceCommandStatus` enums
- [ ] 1.2 Add `Device`, `DeviceCommand`, `DeviceDriver`, `DeviceCapabilities` types
- [ ] 1.3 Add `ProvisionDeviceResponse`, `CreateDeviceCommandDto` DTOs
- [ ] 1.4 Export from `packages/shared/src/index.ts`

## 2. Database schema and migration

- [ ] 2.1 Create `schema/devices.ts` with enums and indexes
- [ ] 2.2 Create `schema/device-commands.ts` with unique `(device_id, request_id)`
- [ ] 2.3 Add `device_id` to `relay_outputs`
- [ ] 2.4 Update `relations.ts` and `schema/index.ts`
- [ ] 2.5 Generate and check the migration with rollback comments
- [ ] 2.6 Backfill each kiosk into a `device` and link relay outputs
- [ ] 2.7 Keep a legacy compatibility mapping for `buildingId`

## 3. Device registry API

- [ ] 3.1 Create `server/api/src/modules/devices/device.service.ts`
- [ ] 3.2 Implement list/create/update/provision/rotate-token
- [ ] 3.3 Generate and hash device tokens; return token only once
- [ ] 3.4 Enforce community scope and RBAC
- [ ] 3.5 Implement heartbeat endpoint and status watchdog
- [ ] 3.6 Implement capabilities validation

## 4. Driver layer

- [ ] 4.1 Define `DeviceDriver` interface
- [ ] 4.2 Implement a `RelayDriver` for `relay_board`/`kiosk`
- [ ] 4.3 Implement a `BarrierDriver` and `TurnstileDriver` skeleton
- [ ] 4.4 Implement a `FaceReaderDriver` and `QrReaderDriver` skeleton
- [ ] 4.5 Implement a driver registry keyed by `driver`
- [ ] 4.6 Map driver errors to stable codes

## 5. Command outbox

- [ ] 5.1 Implement `createDeviceCommand` idempotent by `requestId`
- [ ] 5.2 Implement the command worker with `FOR UPDATE SKIP LOCKED`
- [ ] 5.3 Publish to `community/{communityId}/device/{deviceId}/cmd`
- [ ] 5.4 Subscribe to ack and update status
- [ ] 5.5 Implement timeout + retry with backoff
- [ ] 5.6 Implement failed/dead-letter and replay
- [ ] 5.7 Add command stats endpoint
- [ ] 5.8 Integrate `DeviceActuator` with the access decision engine behind a flag

## 6. MQTT bridge

- [ ] 6.1 Add generic command/ack/state/event topic handling
- [ ] 6.2 Keep legacy relay topics with a deprecation warning
- [ ] 6.3 Validate payloads and reject malformed messages
- [ ] 6.4 Forward acks to the command worker
- [ ] 6.5 Update device status on state messages
- [ ] 6.6 Emit operational events for hardware events

## 7. Edge agent

- [ ] 7.1 Define the edge agent process and configuration
- [ ] 7.2 Fetch and verify the policy snapshot
- [ ] 7.3 Cache rules, access points, keys, and credential metadata
- [ ] 7.4 Execute commands locally and queue results
- [ ] 7.5 Queue access logs with `requestId` and sync on reconnect
- [ ] 7.6 Implement heartbeat, degraded mode, and recovery
- [ ] 7.7 Encrypt local sensitive cache (templates, tokens)

## 8. Observability and retention

- [ ] 8.1 Add device status dashboard data
- [ ] 8.2 Emit offline/degraded events
- [ ] 8.3 Add command lag warning
- [ ] 8.4 Purge completed commands after retention

## 9. Configuration and seed

- [ ] 9.1 Add `DEVICE_ACTUATOR_ENABLED`, MQTT topic prefix, ack timeout, retry limits
- [ ] 9.2 Seed a `kiosk` device and a `relay_board` device
- [ ] 9.3 Seed device tokens for the demo community

## 10. Verification

- [ ] 10.1 Provision a device and publish a command; verify ack and `acked`
- [ ] 10.2 Verify duplicate `requestId` does not re-publish
- [ ] 10.3 Verify ack timeout triggers retry and then `failed`
- [ ] 10.4 Verify replay of a failed command
- [ ] 10.5 Verify legacy relay topic still works
- [ ] 10.6 Verify edge agent opens offline and syncs logs on reconnect
- [ ] 10.7 Verify device token rotation invalidates the old token
- [ ] 10.8 Run `pnpm lint` and `tsc --noEmit`
