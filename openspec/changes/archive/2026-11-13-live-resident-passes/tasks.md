# Tasks: live resident passes

## 1. Servidor: bus y publicación

- [x] 1.1 Crear `server/api/src/lib/pass-bus.ts` con un `EventEmitter` en memoria, `publishPassEvent({ personId, passId, status })` y `onPassEvent(listener)` que devuelva el unsubscribe.
- [x] 1.2 Publicar en `revokePass` después de que el update se confirma.
- [x] 1.3 Publicar en `confirmScan` dentro del camino exitoso, con el estado resultante del pase.
- [x] 1.4 Publicar en `rejectScan`, para que el residente vea el intento aunque el pase siga activo.

## 2. Servidor: ruta del stream

- [x] 2.1 Agregar `GET /api/passes/stream` con `requireRole('owner', 'tenant', 'resident')` y `dynamicQrGuard`.
- [x] 2.2 Identificar al residente con `resolvePersonId` y suscribirse filtrando por ese `personId`.
- [x] 2.3 Escribir headers `text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, mandar `: connected`, heartbeat cada 25 segundos y limpiar en el `close`.
- [x] 2.4 Registrar la ruta antes de `/:id` y verificar que el `tsc` de la API pase.

## 3. Cliente: hook y pantallas

- [x] 3.1 Crear `apps/dashboard/src/lib/use-pass-stream.ts` con `fetch` + `Bearer`, parseo de frames y reconexión a 3 segundos, siguiendo `use-bitacora-stream.ts`.
- [x] 3.2 Montar el hook en `ResidentAuthorizationsPage` para recargar la página actual sin perder filtros ni paginación.
- [x] 3.3 Montar el hook en `ResidentHomePage` para refrescar los «vigentes ahora».
- [x] 3.4 Sondeo de respaldo a 30 segundos en el historial, sólo si el stream está habilitado.

## 4. Verificación

- [x] 4.1 Test de integración: el stream entrega un evento al dueño del pase y no a otro residente.
- [x] 4.2 Test Playwright: con el historial abierto como residente, revocar el pase por API lo marca «Revocada» sin recargar. El camino del escaneo publica el mismo evento desde `confirmScan`, así que comparte el transporte.
- [x] 4.3 Test Playwright: revocar una autorización desde otra sesión la marca «Revocada» en la pestaña abierta.
- [x] 4.4 `tsc` de API y dashboard, Prettier en los archivos tocados y `openspec validate --strict`.
- [x] 4.5 Suite Playwright completa en verde y commit.
