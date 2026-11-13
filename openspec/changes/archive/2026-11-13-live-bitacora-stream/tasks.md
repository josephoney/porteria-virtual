## 1. Servidor

- [x] 1.1 Crear `server/api/src/lib/bitacora-bus.ts` con el `EventEmitter` en memoria, `publishBitacoraEvent` y `onBitacoraEvent`.
- [x] 1.2 Publicar el evento dentro de `insertBitacoraEntry`, para que ninguna ruta se olvide.
- [x] 1.3 Agregar `GET /api/bitacora/stream` antes de `/:id`, con `requireRole('guard','community_admin','org_admin')`, validación de comunidad y `reply.hijack()`.
- [x] 1.4 Mandar heartbeat cada 25 segundos y limpiar la suscripción al cerrar la conexión.

## 2. Cliente

- [x] 2.1 Exportar `apiBaseUrl()` y `currentAccessToken()` desde `apiClient.ts`.
- [x] 2.2 Crear `use-bitacora-stream.ts` con `fetch`, `AbortController`, parseo de frames y reconexión a los 3 segundos.
- [x] 2.3 Suscribir `AccessBitacoraView` y recargar la página visible al recibir un evento.
- [x] 2.4 Bajar el sondeo de respaldo de 15 a 30 segundos.
- [x] 2.5 Suscribir `GuardPanel` y recargar el historial de turnos con `shift_start` y `shift_end`.

## 3. Verificación

- [x] 3.1 `tsc --noEmit` del dashboard y del API sin errores.
- [x] 3.2 Playwright: la bitácora del guardia sigue funcionando sin el sondeo rápido.
- [x] 3.3 Playwright completo en verde.
- [x] 3.4 `pnpm exec openspec validate live-bitacora-stream --strict`.
