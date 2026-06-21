## Why

Cuando el operador está en el panel de administración, bitácora o reportes, las llamadas entrantes no se muestran porque el toast, el ringtone y los handlers WebRTC viven dentro de `OperatorPanel`, que se desmonta al cambiar de ruta. La llamada debe ser prioritaria y visible desde cualquier menú del dashboard.

## What Changes

- **Nuevo `IncomingCallOverlay` en `DashboardLayout`**: Toast de llamada entrante, ringtone, botones aceptar/ignorar visibles en cualquier ruta
- **ActiveCallPiP**: Video overlay flotante en esquina inferior derecha cuando hay llamada activa, con botones colgar y abrir puerta
- **Subida de WebRTC a Layout**: Los handlers de `webrtc:offer`, `webrtc:ice-candidate` y `call:ended` se mueven de `OperatorPanel` al layout
- **Simplificación de `OperatorPanel`**: Se quita la lógica de toast, ringtone, WebRTC y call accept/end. El panel operador solo muestra cola, kiosks, event log e historial
- **Modo inline en OperatorPanel**: Cuando el operador está en su panel, el video de la llamada activa se muestra inline (como ahora). Al cambiar de menú, pasa automáticamente a modo PiP

## Capabilities

### New Capabilities

- `global-call-overlay`: Componente de overlay global para llamadas entrantes y activas, montado en DashboardLayout, visible en cualquier ruta

### Modified Capabilities

- `dashboard-shell`: El layout ahora incluye el overlay de llamadas como hijo directo
- `operator-call-ui`: Se remueve la lógica de toast, ringtone y WebRTC del OperatorPanel; se mantiene el VideoPanel inline para el modo operador

## Impact

- **Frontend**: Nuevo `components/layout/IncomingCallOverlay.tsx`, refactor de `OperatorPanel.tsx`, modificación de `DashboardLayout.tsx`
- **Sin cambios en**: Backend, signaling, API, WebRTC (el hook `useWebRTC` se reutiliza tal cual)
- **SocketContext**: Se mantiene intacto, ya maneja `pendingCalls`, `activeCall`, `stopRing`, `setActiveCall`
