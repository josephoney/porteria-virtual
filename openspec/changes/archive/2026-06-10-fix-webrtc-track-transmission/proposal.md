## Why

El video desde el dashboard al kiosk no se transmite. El dashboard captura cámara correctamente, agrega tracks a la conexión, y envía el answer. Pero el kiosk nunca recibe los tracks remotos (`ontrack` no dispara). La causa raíz: cuando el kiosk crea la oferta sin cámara local (RPi sin permisos de `getUserMedia`), el `RTCPeerConnection` no incluye transceivers de video/audio. El SDP de la oferta no tiene secciones de media, y cuando el dashboard responde con tracks, el navegador no negocia correctamente la recepción porque no hay transceivers configurados para recibir.

## What Changes

- Kiosk: `createAndSendOffer` agrega `addTransceiver('video', { direction: 'recvonly' })` y `addTransceiver('audio', { direction: 'recvonly' })` cuando no hay stream local. Esto garantiza que el SDP incluya secciones de media listas para recibir video/audio del dashboard.
- Kiosk: `createPeerConnection` agrega los transceivers directamente (no en `createAndSendOffer`) para que siempre estén presentes.

## Capabilities

### New Capabilities
- `webrtc-recvonly-transceivers`: El kiosk configura transceivers de recepción aunque no tenga cámara local, asegurando que el video del dashboard se reciba correctamente.

### Modified Capabilities
- `kiosk-webrtc`: `createPeerConnection` ahora siempre agrega transceivers de video+audio con `direction: recvonly` cuando no hay tracks locales.

## Impact

- `apps/kiosk/src/hooks/useWebRTC.ts`: Modificado `createPeerConnection` para agregar transceivers
- No afecta al dashboard ni al servidor
