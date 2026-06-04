## 1. Kiosk WebRTC Fix

- [x] 1.1 Update `createPeerConnection` in kiosk to add recvonly transceivers for video+audio when no local tracks
- [x] 1.2 Remove duplicate `ontrack` setup from `createAndSendOffer` (already set in `createPeerConnection`)
- [x] 1.3 Build kiosk: `pnpm --filter @porteria/kiosk build`
- [x] 1.4 Test: dashboard answers call → kiosk should show dashboard video
