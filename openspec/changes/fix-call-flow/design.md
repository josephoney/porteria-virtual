## Context

El sistema actual tiene implementado el flujo completo de llamada WebRTC con Socket.io, pero tres bugs bloquean su uso básico. El análisis de raíz reveló una race condition en el manejo de `call:ended`, la ausencia de timeout para llamadas ignoradas, y la falta de logs para diagnosticar WebRTC.

## Goals / Non-Goals

**Goals:**
- Corregir la race condition que rompe el kiosk al cancelar y volver a llamar
- Implementar timeout de 30 segundos para llamadas no contestadas
- Agregar logs WebRTC detallados en consola
- Unificar el manejo de fin de llamada en el servidor (eliminar `kiosk:cancel`)

**Non-Goals:**
- No se resuelve el problema de video (solo se agregan logs para diagnosticarlo)
- No se modifica el dashboard (excepto logs WebRTC)
- No se cambia el protocolo de señalización

## Decisions

### 1. Validación de callId en onCallEnded

**Decisión**: `onCallEnded` recibe `{ callId }` y lo compara con `callIdRef.current`. Si no coinciden, ignora el evento.

```typescript
function onCallEnded({ callId }: { callId: string }) {
    if (callIdRef.current !== null && callIdRef.current !== callId) {
        console.log('[Kiosk] Ignoring stale call:ended for', callId);
        return; // ← evita romper una llamada nueva
    }
    callIdRef.current = null;
    webRTCRef.current.cleanupPeer();
    kioskRef.current.resetCall();
}
```

**Razonamiento**: La race condition ocurre porque `call:ended` puede llegar después de que el usuario inició una nueva llamada. Sin esta validación, `onCallEnded` resetea la nueva llamada.

### 2. Timeout en el servidor

**Decisión**: El servidor inicia un `setTimeout` de 30 segundos cuando recibe `call:request`. Si la llamada no es aceptada (`call:accept`), envía `call:ended` al kiosk.

```javascript
socket.on('call:request', () => {
    // ... crear llamada ...
    const timeout = setTimeout(() => {
        if (kiosk.status === 'calling') {
            kiosk.status = 'idle';
            socket.emit('call:ended', { callId, reason: 'timeout' });
            broadcastOperatorState();
        }
    }, 30000);
    // Guardar timeout para limpiarlo si la llamada es aceptada
    callTimeouts.set(callId, timeout);
});

socket.on('call:accept', ({ callId }) => {
    clearTimeout(callTimeouts.get(callId));
    callTimeouts.delete(callId);
    // ...
});
```

**Razonamiento**: 30 segundos es suficiente para que un operador vea y conteste. Sin timeout, el kiosk queda atascado si nadie contesta.

### 3. Eliminar kiosk:cancel

**Decisión**: Eliminar el handler `kiosk:cancel` del servidor. Todo se maneja con `call:end`.

**Razonamiento**: El kiosk ya emite `call:end` al cancelar. El handler `kiosk:cancel` era redundante y generaba confusión. Unificar en un solo evento simplifica el flujo.

### 4. Limpieza local + validación en onCallEnded

**Decisión**: `doCancel` y `doHangUp` hacen reset local inmediato (feedback visual) + emiten `call:end`. `onCallEnded` solo actúa si el `callId` coincide.

**Razonamiento**: El usuario necesita ver feedback inmediato al presionar cancelar. El reset local proporciona eso. La validación en `onCallEnded` evita que eventos stale del servidor interfieran con nuevas llamadas.

### 5. Logs WebRTC

**Decisión**: Agregar `console.log` con prefijo `[WebRTC]` en cada paso del handshake: oferta creada, answer recibida, ICE candidate, estado de conexión.

```typescript
pc.onconnectionstatechange = () => {
    console.log('[WebRTC] Connection state:', pc.connectionState, 'ice:', pc.iceConnectionState);
};
```

**Razonamiento**: Sin logs es imposible diagnosticar por qué el video no se transmite. Estos logs permiten identificar si el problema es de ICE, de tracks, o de señalización.

## Risks / Trade-offs

- **[Riesgo] El timeout de 30s puede ser muy corto/largo** → Ajustable. 30s es un valor inicial razonable.
- **[Trade-off] Reset local + validación en onCallEnded** → Puede causar un doble reset en casos normales (inofensivo, solo llama a setters de estado dos veces).
- **[Riesgo] Memory leak de timeouts** → Se limpian en `call:accept`, `call:end`, y `disconnect`.
