## 1. Dashboard — Ignorar emite call:end

- [x] 1.1 En OperatorPanel.tsx, handler "Ignorar": agregar `socket?.emit('call:end', { callId: toastCall.callId, buildingId: toastCall.buildingId })` antes del cleanup local

## 2. Server — Tipo call:end extendido

- [x] 2.1 En types.ts, cambiar firma de `call:end` para aceptar `{ callId: string; buildingId?: string }`

## 3. Server — Handler call:end notifica al kiosk

- [x] 3.1 En call.ts, handler `call:end`: en rama `if (!call)`, agregar bloque que busca kiosk por `buildingId`, resetea status, y emite `call:ended` al kiosk

## 4. Verificación

- [x] 4.1 Verificar que al hacer click en "Ignorar" desde el dashboard, el kiosk recibe `call:ended` y vuelve a idle
- [x] 4.2 Verificar que "Contestar" sigue funcionando sin cambios
- [x] 4.3 Verificar que el kiosk cancelando sigue funcionando sin cambios
- [x] 4.4 Verificar que la llamada expirada por timeout sigue funcionando sin cambios
