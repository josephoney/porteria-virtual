## 1. Kiosk — Fix Race Condition

- [x] 1.1 Update `onCallEnded` in `apps/kiosk/src/App.tsx` to accept `{ callId }` parameter and validate against `callIdRef.current`
- [x] 1.2 Keep `doCancel` local reset (callIdRef=null, cleanupPeer, resetCall) + emit `call:end` to server
- [x] 1.3 Keep `doHangUp` local reset + emit `call:end` to server
- [x] 1.4 Remove unused `CONFIG` import if present

## 2. Server — Timeout and Cleanup

- [x] 2.1 Add `callTimeouts` Map to server state to track pending timeouts
- [x] 2.2 In `call:request` handler, set a 30-second timeout that auto-cancels unanswered calls
- [x] 2.3 In `call:accept` handler, clear the timeout for the accepted call
- [x] 2.4 In `call:end` handler, clear timeout if it exists before processing
- [x] 2.5 In `disconnect` handler, clear timeouts for disconnected kiosks
- [x] 2.6 Remove `kiosk:cancel` event handler
- [x] 2.7 Ensure `call:ended` is sent back to the kiosk with `reason` field in all branches

## 3. WebRTC Logs — Kiosk

- [x] 3.1 Add log in `createAndSendOffer`: tracks count, offer created, offer sent
- [x] 3.2 Add log in `handleAnswer`: answer received, remote description set
- [x] 3.3 Add log in `handleIceCandidate`: remote ICE candidate added
- [x] 3.4 Add log in `createPeerConnection`: ICE state, connection state, signaling state changes

## 4. WebRTC Logs — Dashboard

- [x] 4.1 Add log in `handleOffer`: offer received, tracks added, answer created, answer sent
- [x] 4.2 Add log in `handleIceCandidate`: remote ICE candidate added
- [x] 4.3 Add log in `createPeerConnection`: ICE state, connection state, signaling state changes

## 5. Build & Verify

- [x] 5.1 Run `pnpm --filter @porteria/kiosk exec tsc --noEmit` — verify no errors
- [x] 5.2 Run `pnpm --filter @porteria/dashboard exec tsc --noEmit` — verify no errors
- [x] 5.3 Test: kiosk calls → cancel → call again → should work without refresh
- [x] 5.4 Test: kiosk calls → wait 30s (don't answer) → kiosk should auto-return to idle
- [x] 5.5 Test: kiosk calls → operator answers → operator hangs up → kiosk returns to idle → can call again
- [x] 5.6 Check browser console for `[WebRTC]` and `[WebRTC-Dashboard]` logs during a call
