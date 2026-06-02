## Why

El kiosk actual vive en `legacy/kiosk.html` como un archivo vanilla JS de 561 líneas. Para integrarse con el sistema de auth (change 3), compartir tipos con `@porteria/shared`, y mantener una sola codebase React en todo el proyecto, necesita migrarse a la app React `apps/kiosk/` que actualmente es un scaffold vacío. Este change reemplaza el placeholder con la UI funcional completa, manteniendo el mismo diseño dark theme, flujo de llamada WebRTC, y comportamiento.

## What Changes

- Reemplazar el scaffold `apps/kiosk/src/App.tsx` con la UI completa del kiosk
- Implementar contexto Socket.io con React Context para conexión al signaling server
- Implementar hook `useWebRTC` para manejo del ciclo de vida WebRTC (offer/answer/ICE)
- Crear 3 pantallas: IdleScreen (reloj + botón llamar), CallingScreen (animación conectando), InCallScreen (video + controles)
- Mantener el diseño visual idéntico al legacy: dark theme, grid background, noise grain, animaciones
- Agregar PWA support: manifest.json + service worker básico
- Mantener compatibilidad con el servidor legacy `legacy/server.js` (mismos eventos Socket.io)

## Capabilities

### New Capabilities
- `kiosk-ui`: Interfaz del kiosk con 3 pantallas (idle, calling, in-call), reloj, botón de llamada, controles de micrófono, y flash de puerta abierta. Mismo diseño dark theme del legacy.
- `kiosk-webrtc`: Hook React para WebRTC: captura de cámara/micrófono, creación de peer connection, manejo de ICE candidates, y limpieza al colgar. Emite eventos Socket.io para señalización.
- `kiosk-connection`: Conexión Socket.io al signaling server con registro de kiosk, recepción de eventos (`call:accepted`, `call:ended`, `door:open`), y reconexión automática.

### Modified Capabilities
<!-- Ninguno -->

## Impact

- **App**: `apps/kiosk/` pasa de scaffold vacío a app funcional con WebRTC + Socket.io
- **Dependencias nuevas**: `socket.io-client` (ya en package.json), `react-router-dom` (no necesario — kiosk no tiene rutas)
- **Legacy**: `legacy/kiosk.html` sigue funcionando — no se elimina hasta verificar paridad
- **No breaking changes**: El signaling server no se toca, los eventos Socket.io son idénticos
