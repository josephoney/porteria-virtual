## Why

El flujo de llamadas tiene tres bugs que impiden el uso básico del sistema:

1. **Cancelar llamada rompe el kiosk**: Si el usuario cancela antes de que contesten, una race condition entre el reset local y el `call:ended` tardío del servidor hace que el kiosk no pueda volver a llamar sin refrescar la página.
2. **Llamada ignorada atasca el kiosk**: Si el operador ignora la llamada (no contesta, no rechaza), el kiosk se queda perpetuamente en estado "llamando" porque nadie le notifica que terminó.
3. **Video WebRTC no diagnosticado**: No hay suficiente visibilidad sobre por qué el video no se transmite, dificultando el debug.

Estos bugs son bloqueantes para la funcionalidad mínima viable del sistema.

## What Changes

- **Race condition en cancel**: `onCallEnded` ahora recibe y verifica el `callId`. Si no coincide con la llamada actual, ignora el evento (evita resetear una llamada nueva).
- **Timeout de llamadas**: El servidor ahora inicia un timer de 30 segundos cuando recibe `call:request`. Si la llamada no es aceptada en ese tiempo, envía `call:ended` al kiosk con reason `'timeout'`.
- **Limpieza del servidor**: Eliminar el handler `kiosk:cancel` (obsoleto — ahora todo usa `call:end`). Unificar el manejo de fin de llamada.
- **Logs WebRTC**: Agregar `console.log` detallados en cada paso del handshake WebRTC (offer, answer, ICE, connection state) tanto en kiosk como en dashboard.
- **Limpieza local segura**: `doCancel` y `doHangUp` hacen reset local inmediato + emiten al servidor, pero `onCallEnded` valida el callId antes de re-ejecutar la limpieza.

## Capabilities

### New Capabilities
- `call-cancel-fix`: Corrección de la race condition en la cancelación de llamadas — `onCallEnded` valida el `callId`, `doCancel` hace reset local inmediato pero no interfiere con llamadas nuevas.
- `call-timeout`: El servidor cancela automáticamente llamadas no contestadas después de 30 segundos, notificando al kiosk con `call:ended { reason: 'timeout' }`.
- `webrtc-logs`: Logs detallados en consola para cada paso del handshake WebRTC en kiosk y dashboard, facilitando el diagnóstico del problema de video.

### Modified Capabilities
- `kiosk-connection`: Modificado el handler `onCallEnded` para recibir y validar `callId`.
- `kiosk-webrtc`: Agregados logs detallados en `createAndSendOffer`, `handleAnswer`, `handleIceCandidate`.
- `kiosk-ui`: `doCancel` ahora hace reset local pero `onCallEnded` tiene guard contra eventos stale.

## Impact

- **Kiosk**: `apps/kiosk/src/App.tsx` — modificado `onCallEnded`, `doCancel`, `doHangUp`
- **Kiosk WebRTC**: `apps/kiosk/src/hooks/useWebRTC.ts` — agregados logs
- **Dashboard WebRTC**: `apps/dashboard/src/hooks/useWebRTC.ts` — agregados logs
- **Servidor**: `legacy/server.js` — agregado timeout, removido `kiosk:cancel`, modificado `call:end`
- **No breaking changes**: Los eventos Socket.io siguen siendo los mismos, solo se agrega `call:ended` con `reason` adicional
