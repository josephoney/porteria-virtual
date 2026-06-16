## 1. Ring Sound

- [x] 1.1 Create ring tone using Web Audio API oscillator (no external file needed) in `SocketContext.tsx` — generates a pleasant 800Hz + 1000Hz dual-tone
- [x] 1.2 Start ring on `call:incoming` event — loop with 1s on, 2s off pattern
- [x] 1.3 Stop ring on `call:taken` event
- [x] 1.4 Stop ring on `call:ended` event
- [x] 1.5 Stop ring in OperatorPanel when operator clicks "Contestar"

## 2. Call Display Mode Toggle

- [x] 2.1 Add `callDisplayMode` state to `OperatorPanel.tsx` — 'inline' | 'overlay', persisted in localStorage
- [x] 2.2 Add toggle switch UI in OperatorPanel header
- [x] 2.3 Update `VideoPanel.tsx` to accept `displayMode` prop and render as overlay when 'overlay'
- [x] 2.4 Add PiP (minimized) state and toggle button in overlay mode
- [x] 2.5 Add CSS for overlay, PiP, and transition animations in `App.css`

## 3. Audio Verification Logs

- [x] 3.1 In kiosk `useWebRTC.ts`: log audio track count and labels in `getLocalStream`
- [x] 3.2 In kiosk `useWebRTC.ts`: log audio track details on `ontrack` (remote stream)
- [x] 3.3 In dashboard `useWebRTC.ts`: same audio track logs as kiosk
- [x] 3.4 Log mute state changes with track kind detail

## 4. Build and Verify

- [x] 4.1 Run `tsc --noEmit` in apps/kiosk
- [x] 4.2 Run `tsc --noEmit` in apps/dashboard
- [x] 4.3 Build both apps
- [x] 4.4 Verify ring sound plays on incoming call
- [x] 4.5 Verify overlay/PiP toggle works
- [x] 4.6 Check browser console for audio track logs
