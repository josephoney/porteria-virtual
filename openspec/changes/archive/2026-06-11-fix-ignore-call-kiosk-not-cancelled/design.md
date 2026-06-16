## Context

El flujo de llamada kiosk→operator pasa por dos fases:

1. **Fase de ringing**: Kiosk emite `call:request` → server crea `callId`, setea timeout, emite `call:incoming` a operators y `call:waiting` al kiosk. En esta fase **no hay entry en `state.calls`** — solo se crea cuando el operador acepta.

2. **Fase activa**: Operador emite `call:accept` → server crea entry en `state.calls`, cancela timeout, emite `call:accepted` al kiosk y `call:taken` a otros operators.

El bug existe porque "Ignorar" ocurre en la fase 1, donde `state.calls` no tiene entry. El handler `call:end` actual solo forwardea al kiosk si existe la entry (`call.kioskSocketId`), o si quien cancela es el kiosk mismo. Si un operador cancela en fase 1, el servidor no sabe a qué kiosk forwardear.

## Goals / Non-Goals

**Goals:**
- Al hacer click en "Ignorar", el kiosk recibe `call:ended` y vuelve a idle inmediatamente
- El fix funciona tanto si la llamada está en fase 1 (ringing) como en fase 2 (activa)

**Non-Goals:**
- No cambia el comportamiento de "Contestar" ni "Colgar"
- No modifica el timeout de 30s del servidor
- No agrega nuevos eventos al protocolo

## Decisions

### 1. Extender `call:end` con `buildingId` opcional en vez de crear un nuevo evento

**Elegido:** `call:end` acepta `{ callId: string; buildingId?: string }`

**Alternativa:** Crear un nuevo evento `call:ignore`. Descartada porque `call:end` ya existe y el comportamiento deseado es idéntico (cancelar la llamada). Agregar un nuevo evento duplicaría lógica.

### 2. El dashboard envía `buildingId` en `call:end`

El `buildingId` ya está disponible en el objeto `toastCall` (viene del evento `call:incoming`). Esto permite al servidor encontrar el kiosk correcto sin necesidad de scanear todo `state.kiosks`.

### 3. Server: buscar kiosk por `buildingId` en la rama `!call`

En `call.ts`, cuando `state.calls.get(callId)` es `undefined` y `buildingId` está presente, se busca el kiosk en `state.kiosks.get(buildingId)`. Si existe y está en estado `calling`, se resetea a `idle` y se le emite `call:ended`.

Esto es simétrico al comportamiento existente para el caso kiosk (líneas 21-25), pero para el caso operador.

```
call:end handler actual:

  if (!call) {
    if (kiosk canceló) → reset kiosk status, emitir call:ended al kiosk
    emitir call:ended al requester
    emitir call:ended a operators
    return
  }
  
  // call existe, forward normal
  forward al otro peer
  delete call

call:end handler modificado:

  if (!call) {
    if (kiosk canceló) → reset kiosk status, emitir call:ended al kiosk
+   if (operador canceló con buildingId) → buscar kiosk, reset, emitir call:ended al kiosk
    emitir call:ended al requester
    emitir call:ended a operators
    return
  }
  
  // call existe, forward normal
  forward al otro peer
  delete call
```

## Risks / Trade-offs

- **[Stale buildingId]**: Si el toast muestra una llamada vieja (el kiosk ya canceló por timeout), el servidor intentará resetear un kiosk que ya está en idle → operación idempotente, sin efecto secundario.
- **[Tipo de payload]**: `buildingId` es opcional para mantener compatibilidad con el kiosk que emite `call:end` sin `buildingId` → sin breaking change.
