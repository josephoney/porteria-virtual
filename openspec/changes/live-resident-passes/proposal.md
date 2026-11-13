# Proposal: live resident passes

## Why

El residente autoriza una visita y, cuando el guardia la escanea en la portería, su historial sigue diciendo «Activa» hasta que recarga la página. Lo mismo pasa si revoca desde otra pestaña. El estado del pase cambia en el servidor y la pantalla del residente no se entera.

El tablero del guardia ya resuelve esto con un stream en vivo. El residente es el otro lado de la misma operación: quien autorizó necesita ver que la autorización se usó.

## What Changes

- Un bus de eventos en el servidor que publica cada cambio de estado de un pase, dirigido a la persona que lo creó.
- `GET /api/passes/stream`: stream SSE para el residente autenticado, filtrado por su `personId`.
- El historial de autorizaciones y los «vigentes ahora» del inicio se recargan al recibir un evento, sin esperar a que el usuario refresque.
- Un sondeo de respaldo a 30 segundos, igual que en la bitácora, por si el stream se corta.

## Capabilities

### New Capabilities

- `live-resident-passes`: el residente ve el estado de sus autorizaciones actualizarse sin recargar, y sólo recibe eventos de sus propios pases.

### Modified Capabilities

- Ninguna.

## Impact

- `server/api/src/lib/pass-bus.ts` (nuevo), `server/api/src/routes/pass.routes.ts`, `server/api/src/services/pass.service.ts`, `server/api/src/services/access-scan.service.ts`.
- `apps/dashboard/src/lib/use-pass-stream.ts` (nuevo), `apps/dashboard/src/pages/ResidentAuthorizationsPage.tsx`, `apps/dashboard/src/pages/ResidentHomePage.tsx`.
- Sin cambios de base de datos, sin dependencias nuevas, sin cambios en `@porteria/shared`.

## Fuera de alcance

- Notificaciones push al teléfono del residente. Este change sólo actualiza la pantalla abierta.
- El historial de la app móvil, que hoy no tiene refresco automático de ningún tipo.
- Eventos de otras personas de la comunidad: el bus nunca los entrega a un residente.
