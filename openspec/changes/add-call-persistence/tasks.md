## 1. Shared DTOs

- [x] 1.1 Create `packages/shared/src/dto/calls.ts` with `CreateCallDto` and `UpdateCallDto` interfaces
- [x] 1.2 Export new DTOs from `packages/shared/src/index.ts`

## 2. API Server: events service

- [x] 2.1 Create `server/api/src/services/events.service.ts` with `insertEvent()` function
- [x] 2.2 `insertEvent` accepts `{ eventType, actorId?, actorRole?, organizationId, locationId?, accessPointId?, metadata? }`

## 3. API Server: calls write service

- [x] 3.1 Add `createCall()` to `calls.service.ts`: resolves buildingId → kioskId → organizationId via JOIN chain, INSERTs into `calls` with status `pending`, INSERTs `call.started` event
- [x] 3.2 Add `updateCall()` to `calls.service.ts`: UPDATEs status/operatorId/endedAt/duration on `calls`, INSERTs corresponding event if `eventType` provided
- [x] 3.3 Add optional `operatorId` filter to existing `listCalls()` function
- [x] 3.4 Add `callId` parameter to `createCall` so signaling server's callId is used directly as primary key

## 4. API Server: internal routes

- [x] 4.1 Add `INTERNAL_API_KEY` to `server/api/src/config.ts` (from env, with dev default)
- [x] 4.2 Add `POST /api/internal/calls` route in `calls.routes.ts` with API key middleware (calls `createCall`)
- [x] 4.3 Add `PATCH /api/internal/calls/:callId` route in `calls.routes.ts` with API key middleware (calls `updateCall`)
- [x] 4.4 Add `getCallById` call lookup in `updateCall` to get `organizationId` for event insertion
- [x] 4.5 Modify existing `GET /api/calls` to force `operatorId` to JWT user for non-admin roles
- [x] 4.6 Register internal routes without JWT auth (separate Fastify plugin or prefix)

## 5. Signaling Server: persistence calls

- [x] 5.1 Add `API_BASE_URL` and `INTERNAL_API_KEY` to `server/signaling/src/config.ts`
- [x] 5.2 In `handlers/kiosk.ts` `call:request` handler: add fire-and-forget POST to `/api/internal/calls` with `{ callId, buildingId, visitor }` after emitting events
- [x] 5.3 In `handlers/operator.ts` `call:accept` handler: add fire-and-forget PATCH to `/api/internal/calls/{callId}` with `{ status: 'active', operatorId }` after emitting events
- [x] 5.4 In `handlers/call.ts` `call:end` handler: add fire-and-forget PATCH with status, endedAt, duration, eventType. Determine `missed` vs `ended` based on whether call is in `state.calls`
- [x] 5.5 In `handlers/kiosk.ts` timeout handler: add fire-and-forget PATCH with `{ status: 'missed', endedAt, eventType: 'call.missed' }`
- [x] 5.6 In `index.ts` disconnect handler: add fire-and-forget PATCH for active calls ended by disconnect
- [x] 5.7 All persistence calls use `fetch()` with `.catch()` logging via `app.log.warn`

## 6. Dashboard: Admin CallHistoryTable

- [x] 6.1 Create `apps/dashboard/src/components/admin/CallHistoryTable.tsx` with paginated table, status/date filters, and status badges
- [x] 6.2 Fetch calls via `apiClient.get('/api/calls?...')` with query params for page, pageSize, status, from, to
- [x] 6.3 Implement pagination controls (← page / total →)
- [x] 6.4 Implement status filter dropdown (Todas, Pendiente, Activa, Finalizada, Perdida)
- [x] 6.5 Implement date range inputs (Desde / Hasta)
- [x] 6.6 Add status badge rendering with colors matching design system
- [x] 6.7 Integrate `CallHistoryTable` into `AdminPanel.tsx` below the users section

## 7. Dashboard: Operator call history

- [x] 7.1 Add collapsible "Mis llamadas" section in `OperatorPanel.tsx` below the EventLog
- [x] 7.2 Fetch operator's calls via `apiClient.get('/api/calls?operatorId=<id>&pageSize=50')` using `useAuth().user.id`
- [x] 7.3 Display calls in a compact table: kiosk name, time (HH:MM), status (Atendida/Perdida)
- [x] 7.4 Add 60-second polling interval to refresh call history
- [x] 7.5 Handle empty state: "Aún no has atendido llamadas"

## 8. Verification

- [ ] 8.1 Start kiosk, press call button: verify call appears in `GET /api/calls` with status `pending`
- [ ] 8.2 Accept call from operator: verify call status updates to `active` and `operatorId` is set
- [ ] 8.3 End call: verify call status updates to `ended` with `duration` > 0
- [ ] 8.4 Let call timeout (30s): verify call status is `missed`
- [ ] 8.5 Admin panel: verify call history table loads, pagination works, filters work
- [ ] 8.6 Operator panel: verify "Mis llamadas" shows only own calls
- [ ] 8.7 Verify `call.started`, `call.ended`, `call.missed` events are inserted in `events` table
