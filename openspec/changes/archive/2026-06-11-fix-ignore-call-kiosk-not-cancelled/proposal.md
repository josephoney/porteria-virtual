## Why

Cuando el operador hace click en "Ignorar" ante una llamada entrante, el dashboard limpia su estado local (quita la llamada de la cola, silencia el ring, oculta el toast) pero **nunca emite `call:end` al servidor de señalización**. El kiosk se queda trabado en pantalla "Llamando..." hasta que el timeout de 30 segundos expira. El usuario visitante espera sin saber que fue ignorado.

Además, el handler `call:end` del servidor no maneja el caso donde un operador cancela una llamada que todavía no fue aceptada (`call` no existe en `state.calls` porque solo se crea en `call:accept`). En ese caso el servidor no le avisa al kiosk.

## What Changes

- **Dashboard**: El botón "Ignorar" emite `socket.emit('call:end', { callId, buildingId })` antes del cleanup local
- **Server types**: `call:end` payload acepta `buildingId` opcional
- **Server call handler**: Cuando `call` no existe en `state.calls` y se recibe `buildingId`, busca el kiosk por `buildingId`, resetea su status a `idle`, y emite `call:ended` a ese kiosk

## Capabilities

### Modified Capabilities
- `dashboard-operator`: El handler de "Ignorar" ahora emite `call:end` al socket antes del cleanup local
- `signaling-server`: El handler `call:end` maneja el caso de llamada no asignada con `buildingId` para notificar al kiosk correcto

## Impact

- `apps/dashboard/src/components/operator/OperatorPanel.tsx`: Línea 214 — agregar `socket?.emit(...)` (~3 líneas)
- `server/signaling/src/types.ts`: Línea 77 — extender payload de `call:end` (~1 línea)
- `server/signaling/src/handlers/call.ts`: Líneas 20-31 — agregar búsqueda por `buildingId` en rama `!call` (~6 líneas)
