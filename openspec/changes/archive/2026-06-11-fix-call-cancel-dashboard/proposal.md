## Why

Tres bugs en el flujo de llamadas kiosk-dashboard rompen la experiencia del operador:

1. **Cancelar desde kiosk no limpia el dashboard**: Cuando el kiosk cancela una llamada antes de que el operador conteste, la llamada sigue apareciendo en la cola de llamadas pendientes del dashboard. El servidor solo notifica al kiosk con `call:ended`, no a los operadores. Y el dashboard no tiene listener para `call:ended` en el contexto de llamadas pendientes.

2. **Terminar desde kiosk revive el toast**: Cuando el kiosk cuelga una llamada activa, el toast de "Llamada entrante" reaparece en el dashboard con datos stale. El `useEffect` del toast nunca limpia `toastCall` cuando `pendingCalls` se vacía — el valor queda latente y revive apenas `activeCall` se pone en `null`.

3. **Timeout no notifica a todos los operadores**: El mismo problema que el bug 1 aplica al timeout de 30s — solo el kiosk recibe `call:ended`, los operadores se quedan con la llamada en cola.

## What Changes

- **Signaling server** (`call.ts`): En el branch de llamada no aceptada, emitir `call:ended` a todos los operadores, no solo al kiosk
- **Dashboard SocketContext**: Agregar listener de `call:ended` que elimine la llamada de `pendingCalls` y registre en el log
- **Dashboard OperatorPanel**: Limpiar `toastCall` cuando `pendingCalls.size` llega a 0 en el `useEffect`

## Capabilities

### Modified Capabilities
- `signaling-server`: `call:ended` ahora se emite a la room `operators` cuando una llamada se cancela antes de ser aceptada, no solo al kiosk.
- `dashboard-operator`: El toast de llamada entrante se limpia correctamente cuando la cola se vacía. Las llamadas canceladas se eliminan de la cola pendiente.

## Impact

- `server/signaling/src/handlers/call.ts`: +1 línea (emit a operators room)
- `apps/dashboard/src/contexts/SocketContext.tsx`: +1 listener (~8 líneas)
- `apps/dashboard/src/components/operator/OperatorPanel.tsx`: ~3 líneas (limpiar toastCall)
