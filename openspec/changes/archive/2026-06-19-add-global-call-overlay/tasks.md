## 1. Create IncomingCallOverlay component

- [x] 1.1 Create `apps/dashboard/src/components/layout/IncomingCallOverlay.tsx`
- [x] 1.2 Read `pendingCalls`, `activeCall`, `setActiveCall`, `removePendingCall`, `stopRing` from `useSocket()`
- [x] 1.3 Implement toast: show latest pendingCall with building name, visitor info, "Contestar" and "Ignorar" buttons
- [x] 1.4 Implement ringtone: play on new pendingCall, stop on accept/reject/taken/ended (reuse ringtone player from `lib/ringtones.ts`)
- [x] 1.5 Implement toast auto-dismiss after 30 seconds (clearTimeout on unmount)

## 2. Move WebRTC and call lifecycle to overlay

- [x] 2.1 Use `useWebRTC()` hook in IncomingCallOverlay
- [x] 2.2 Move `handleAcceptCall` from OperatorPanel to overlay: getLocalStream, emit call:accept, setActiveCall, stopRing
- [x] 2.3 Register Socket.io handlers in overlay: `webrtc:offer` → handleOffer, `webrtc:ice-candidate` → handleIceCandidate
- [x] 2.4 Register `call:ended` handler in overlay: cleanupPeer, setActiveCall(null)
- [x] 2.5 Implement `handleEndCall` in overlay: emit call:end, cleanupPeer, setActiveCall(null)
- [x] 2.6 Implement `handleOpenDoor` in overlay: emit door:open with activeCall.buildingId

## 3. Active call PiP overlay

- [x] 3.1 When `activeCall` is set, render PiP overlay with `position: fixed; bottom: 16px; right: 16px; z-index: 10000`
- [x] 3.2 PiP shows remote video via `<video>` element bound to `webRTC.remoteStream`
- [x] 3.3 PiP controls: Colgar button, Abrir Puerta button, Mute/Unmute toggle
- [x] 3.4 Minimize PiP: collapse to small badge showing building name, click to restore
- [x] 3.5 PiP disappears when `activeCall` becomes null

## 4. Update DashboardLayout

- [x] 4.1 Import and render `<IncomingCallOverlay />` in `DashboardLayout.tsx` before `<Outlet />`
- [x] 4.2 Ensure overlay has `position: fixed` and high `z-index` via CSS

## 5. Move RingtoneSelector to TopBar

- [x] 5.1 Render `<RingtoneSelector />` in `TopBar.tsx` instead of `OperatorPanel.tsx`
- [x] 5.2 RingtoneSelector uses `useSocket()` context for `selectedRingtoneId`, `setRingtone`, `previewRingtone`

## 6. Simplify OperatorPanel

- [x] 6.1 Remove `toastCall` state and related useEffect (lines 120-129)
- [x] 6.2 Remove ringtone play logic from OperatorPanel (now in overlay)
- [x] 6.3 Remove WebRTC Socket.io handlers: `webrtc:offer`, `webrtc:ice-candidate`, `call:ended` (now in overlay)
- [x] 6.4 Remove `handleAcceptCall`, `handleEndCall`, `handleOpenDoor` (now in overlay)
- [x] 6.5 Remove RingtoneSelector import and usage (now in TopBar)
- [x] 6.6 Keep VideoPanel inline for when route is `/` and `callDisplayMode === 'inline'`
- [x] 6.7 Keep relay controls, MQTT socket, CallQueue, KioskList, EventLog, OperatorCallHistory

## 7. Auto-overlay behavior on route change

- [x] 7.1 In IncomingCallOverlay, determine if current route is `/` using `useLocation()`
- [x] 7.2 When route is NOT `/` and `activeCall` exists, force show PiP (hide inline video in OperatorPanel)
- [x] 7.3 When route IS `/` and `callDisplayMode === 'inline'`, hide PiP (show inline in OperatorPanel)

## 8. Verification

- [ ] 8.1 Receive call while on operator panel → toast appears, ringtone plays, accept works
- [ ] 8.2 Receive call while on admin panel → toast appears, ringtone plays, accept works
- [ ] 8.3 Navigate from `/` to `/admin` during active call → PiP overlay appears
- [ ] 8.4 Navigate back from `/admin` to `/` during active call → inline video restores
- [ ] 8.5 End call from PiP overlay while on admin panel → call ends, PiP disappears
- [ ] 8.6 Open door from PiP overlay while on admin panel → door opens
- [ ] 8.7 Ringtone selector works from TopBar on any route
- [ ] 8.8 Multiple operators: call taken by another → ringtone stops, toast dismisses
