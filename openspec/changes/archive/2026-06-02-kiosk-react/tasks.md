## 1. Dependencies and Setup

- [x] 1.1 Install `socket.io-client` in `apps/kiosk/` (may already exist in package.json)
- [x] 1.2 Create `apps/kiosk/src/config.ts` with BUILDING_ID, BUILDING_NAME, ADDRESS, SERVER_URL, ICE_SERVERS
- [x] 1.3 Create `apps/kiosk/src/hooks/useClock.ts` — returns current time string, updates every second
- [x] 1.4 Verify `tsc --noEmit` passes before starting

## 2. Socket.io Context

- [x] 2.1 Create `apps/kiosk/src/contexts/SocketContext.tsx` — SocketProvider with connection, registration, disconnect handling
- [x] 2.2 Wrap the app with SocketProvider in `main.tsx`
- [x] 2.3 Create `apps/kiosk/src/hooks/useSocket.ts` — convenience hook to access socket context
- [x] 2.4 Emit `kiosk:register` on connect with buildingId and buildingName
- [x] 2.5 Listen for `kiosk:registered`, `disconnect`, and `error` events

## 3. WebRTC Hook

- [x] 3.1 Create `apps/kiosk/src/hooks/useWebRTC.ts` — manages RTCPeerConnection, localStream, remoteStream
- [x] 3.2 Implement `getLocalStream()` — getUserMedia({ video: true, audio: true })
- [x] 3.3 Implement `createPeerConnection()` — new RTCPeerConnection with ICE servers, add tracks, ontrack, onicecandidate
- [x] 3.4 Implement `createAndSendOffer()` — create offer, set local description, emit `webrtc:offer`
- [x] 3.5 Handle incoming `webrtc:answer` — set remote description
- [x] 3.6 Handle incoming `webrtc:ice-candidate` — add ICE candidate
- [x] 3.7 Implement `cleanupPeer()` — close connection, stop tracks, null video elements
- [x] 3.8 Implement `toggleMute()` — enable/disable audio tracks

## 4. Kiosk State Hook

- [x] 4.1 Create `apps/kiosk/src/hooks/useKioskState.ts` — manages: screen (idle/calling/in-call), currentCallId, callTimer, operatorName, isMuted
- [x] 4.2 Implement call timer: start, stop, reset with MM:SS format
- [x] 4.3 Implement status dot state: connected, calling, in-call, disconnected

## 5. UI Components — TopBar and IdleScreen

- [x] 5.1 Create `apps/kiosk/src/components/TopBar.tsx` — brand "PORTERÍA VIRTUAL", status dot + text, conditionally visible
- [x] 5.2 Create `apps/kiosk/src/components/IdleScreen.tsx` — clock display, building name, address, call button with rings
- [x] 5.3 Style TopBar and IdleScreen matching legacy dark theme (CSS variables, grid bg, noise grain)
- [x] 5.4 Call button triggers `call:request` via socket

## 6. UI Components — CallingScreen

- [x] 6.1 Create `apps/kiosk/src/components/CallingScreen.tsx` — pulsing phone icon animation, "CONECTANDO…", cancel button
- [x] 6.2 Cancel button emits `call:end` and resets state

## 7. UI Components — InCallScreen

- [x] 7.1 Create `apps/kiosk/src/components/InCallScreen.tsx` — remote video fullscreen, local video PiP, operator badge, call timer
- [x] 7.2 Mute button with toggle visuals (opacity change)
- [x] 7.3 Hang-up button (red, emits `call:end`)
- [x] 7.4 Handle `call:accepted` to show operator name badge

## 8. UI Components — DoorFlash and ConnectionOverlay

- [x] 8.1 Create `apps/kiosk/src/components/DoorFlash.tsx` — full-screen green overlay "PUERTA ABIERTA", auto-hides after 2.5s
- [x] 8.2 Create connection overlay — spinner + "Conectando al servidor…", hides when connected, shows on disconnect

## 9. App Integration

- [x] 9.1 Rewrite `apps/kiosk/src/App.tsx` — TopBar + screen switch (idle/calling/in-call) + DoorFlash + connection overlay
- [x] 9.2 Move all dark theme CSS from legacy to `apps/kiosk/src/App.css`
- [x] 9.3 Wire Socket.io events to state transitions (call:accepted → in-call, door:open → flash, etc.)
- [x] 9.4 Call request flow: click → getLocalStream → emit call:request → calling screen
- [x] 9.5 Call acceptance flow: receive call:accepted → switch to in-call → createAndSendOffer
- [x] 9.6 Call end flow: emit call:end → cleanup peer → switch to idle

## 10. PWA and Final Verification

- [x] 10.1 Add `vite-plugin-pwa` and configure manifest.json (name: "Portería Virtual", theme_color: #0a0c0f)
- [x] 10.2 Configure service worker with cache-first strategy for assets
- [x] 10.3 Build kiosk app: `pnpm --filter @porteria/kiosk build` succeeds
- [x] 10.4 Run with legacy signaling server: `node legacy/server.js` + `pnpm --filter @porteria/kiosk dev`
- [x] 10.5 Verify idle screen renders with clock, building name, call button
- [x] 10.6 Verify UI visually matches legacy kiosk.html (dark theme, animations, grid background)
