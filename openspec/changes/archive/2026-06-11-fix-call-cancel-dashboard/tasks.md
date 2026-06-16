## 1. Signaling Server Fix

- [x] 1.1 In `server/signaling/src/handlers/call.ts`, add `io.to('operators').emit('call:ended', { callId, reason: 'cancelled' })` in the `if (!call)` branch (after the kiosk emit, before broadcast)
- [x] 1.2 In `server/signaling/src/handlers/kiosk.ts`, add `io.to('operators').emit('call:ended', { callId, reason: 'timeout' })` in the timeout callback (after the kiosk emit, before broadcast)

## 2. Dashboard SocketContext Fix

- [x] 2.1 Add `call:ended` listener in `apps/dashboard/src/contexts/SocketContext.tsx` that calls `removePendingCall(callId)` and `addLog('END', ...)` with appropriate message based on reason

## 3. Dashboard OperatorPanel Fix

- [x] 3.1 In `apps/dashboard/src/components/operator/OperatorPanel.tsx`, update the toast `useEffect` to call `setToastCall(null)` when `pendingCalls.size === 0`

## 4. Build and Verify

- [x] 4.1 Run `tsc --noEmit` in server/signaling
- [x] 4.2 Run `tsc --noEmit` in apps/dashboard
- [x] 4.3 Build both packages
