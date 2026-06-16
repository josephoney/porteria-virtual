## 1. Types and Config

- [x] 1.1 Create `server/signaling/src/types.ts` — TypedSocket interface with `data.role`, `data.buildingId`, `data.operatorId`; KioskData, OperatorData, CallData, VisitorData interfaces; ClientToServerEvents and ServerToClientEvents maps with all event signatures
- [x] 1.2 Create `server/signaling/src/config.ts` — PORT (3001 default), CORS_ORIGIN (*), CALL_TIMEOUT_MS (30000), TURN credentials reference
- [x] 1.3 Create `server/signaling/src/state.ts` — SignalingState interface, createState() factory function returning { kiosks: Map, operators: Map, calls: Map, callTimeouts: Map }
- [x] 1.4 Create `server/signaling/src/utils.ts` — generateCallId() and broadcastOperatorState(io, state) helper functions

## 2. Kiosk Handlers

- [x] 2.1 Create `server/signaling/src/handlers/kiosk.ts` — registerKioskHandlers(socket, io, state)
- [x] 2.2 Implement `kiosk:register` — validate buildingId, store in state.kiosks, set socket.data, join room, emit `kiosk:registered`, broadcast state
- [x] 2.3 Implement `call:request` — validate kiosk role, force idle if not idle, generate callId, set status to calling, start 30s timeout, emit `call:incoming` to operators, emit `call:waiting` to kiosk, broadcast state
- [x] 2.4 Implement `visitor:identified` — update kiosk.lastVisitor, emit to operators room with building info

## 3. Operator Handlers

- [x] 3.1 Create `server/signaling/src/handlers/operator.ts` — registerOperatorHandlers(socket, io, state)
- [x] 3.2 Implement `operator:register` — validate operatorId, store in state.operators, set socket.data, join operators room, emit `operator:registered` with full kiosk list
- [x] 3.3 Implement `call:accept` — validate operator role, validate kiosk exists, set kiosk status to in-call, store call in calls Map, clear timeout, emit `call:accepted` to kiosk, emit `call:taken` to other operators, emit `call:ready` to accepting operator, broadcast state
- [x] 3.4 Implement `door:open` — validate operator role, find kiosk by buildingId, emit `door:open` to kiosk socket, log event

## 4. Call Handler

- [x] 4.1 Create `server/signaling/src/handlers/call.ts` — registerCallHandlers(socket, io, state)
- [x] 4.2 Implement `call:end` — clear timeout if exists, handle both pre-accept (cancelled) and post-accept (active) cases, reset kiosk status, emit `call:ended` to other peer, remove from calls Map, broadcast state

## 5. WebRTC Relay Handler

- [x] 5.1 Create `server/signaling/src/handlers/webrtc.ts` — registerWebRTCHandlers(socket, io, state)
- [x] 5.2 Implement `webrtc:offer` — validate call exists, relay to other peer in the call
- [x] 5.3 Implement `webrtc:answer` — validate call exists, relay to other peer in the call
- [x] 5.4 Implement `webrtc:ice-candidate` — validate call exists, relay to other peer in the call

## 6. Main Server Bootstrap

- [x] 6.1 Update `server/signaling/src/index.ts` — create state, register connection handler, wire all handler modules on `io.on('connection')`, implement `disconnect` cleanup logic (clear timeouts, remove kiosk/operator, end active calls, broadcast state)
- [x] 6.2 Implement enhanced health check with kiosks/operators/calls counts
- [x] 6.3 Structured logging: log all connection, registration, call lifecycle, and disconnect events with contextual data

## 7. Root Scripts Update

- [x] 7.1 Update root `package.json` scripts: `dev:full` and `dev:clean` to use `pnpm --filter @porteria/signaling dev` instead of `node legacy/server.js`

## 8. Build and Verify

- [x] 8.1 Run `tsc --noEmit` in server/signaling — verify no TypeScript errors
- [x] 8.2 Run `pnpm --filter @porteria/signaling build` — verify production build succeeds
- [ ] 8.3 Start signaling server: `pnpm --filter @porteria/signaling dev` — verify health check at `http://localhost:3001/health`
- [ ] 8.4 Test kiosk flow: open kiosk app, verify it connects and registers, press call button, verify `call:waiting` received
- [ ] 8.5 Test operator flow: open dashboard, login, verify operator registers and receives kiosk list
- [ ] 8.6 Test full call: kiosk calls → operator receives incoming → operator accepts → verify `call:accepted` on kiosk
- [ ] 8.7 Test call cancel: kiosk calls → kiosk cancels → verify kiosk returns to idle
- [ ] 8.8 Test call timeout: kiosk calls → wait 30s without answering → verify kiosk receives `call:ended` with `reason: 'timeout'`
- [ ] 8.9 Test disconnect cleanup: operator disconnects during active call → verify kiosk receives `call:ended` and returns to idle
- [ ] 8.10 Verify WebRTC relay: offer/answer/ICE candidates forwarded correctly between peers
- [ ] 8.11 Verify door control: operator emits `door:open` → kiosk receives `door:open`
- [ ] 8.12 Verify legacy server.js still works independently (no regression)
