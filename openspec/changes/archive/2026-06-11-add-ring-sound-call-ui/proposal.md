## Why

Tres carencias en la experiencia del operador durante las videollamadas:

1. **Sin sonido de llamada entrante**: El operador solo ve un toast visual. Si no está mirando la pantalla, se pierde la llamada. Necesita un ring audible que se active en `call:incoming` y se detenga al aceptar, cancelar o timeout.

2. **VideoPanel fijo en el centro**: El operador pierde visibilidad de los logs y la cola de llamadas cuando está en una videollamada activa. Necesita poder ver el panel de eventos y kiosks mientras atiende.

3. **Audio no verificado**: No hay visibilidad sobre si los tracks de audio se están transmitiendo correctamente entre kiosk y dashboard. Los logs actuales no discriminan entre video y audio.

## What Changes

- **Ring sound**: Archivo `ring.mp3` en `public/`, reproducción en loop al recibir `call:incoming`, detención en `call:taken`, `call:ended`, y al aceptar la llamada
- **Call display toggle**: Switch "Modo ventana superpuesta" en el OperatorPanel. Al activarse, VideoPanel se renderiza como overlay fullscreen sobre el dashboard con botón minimizar a PiP. Al desactivarse, comportamiento actual (panel central).
- **Audio verification logs**: Logs específicos de audio tracks en ambos `useWebRTC.ts` (kiosk y dashboard) mostrando cantidad de audio tracks, labels, y estado de muted

## Capabilities

### New Capabilities
- `operator-call-ui`: Sonido de llamada entrante, toggle de modo de visualización de videollamada (inline vs overlay), y logs de verificación de audio en WebRTC.

### Modified Capabilities
- `dashboard-operator`: VideoPanel ahora soporta modo overlay y PiP. SocketContext incluye manejo de audio ring.
- `kiosk-webrtc`: Logs de audio tracks agregados.

## Impact

- `apps/dashboard/src/contexts/SocketContext.tsx`: Ring audio logic (~20 líneas)
- `apps/dashboard/src/components/operator/OperatorPanel.tsx`: Toggle switch + overlay/PiP state (~15 líneas)
- `apps/dashboard/src/components/operator/VideoPanel.tsx`: Overlay + PiP rendering (~30 líneas)
- `apps/dashboard/src/App.css`: Estilos overlay/PiP (~40 líneas)
- `apps/dashboard/public/ring.mp3`: Nuevo asset (generado vía Web Audio API)
- `apps/kiosk/src/hooks/useWebRTC.ts`: Audio track logs (~5 líneas)
- `apps/dashboard/src/hooks/useWebRTC.ts`: Audio track logs (~5 líneas)
