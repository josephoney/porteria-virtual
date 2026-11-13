# Bitácora en vivo

## Why

El tablero del guardia refresca la bitácora cada 15 segundos y eso no alcanza para lo que el guardia necesita ver: cuando abre o cierra un turno desde la app, o cuando decide un escaneo, la tabla no cambia hasta que alguien aprieta «Actualizar». Un panel de operación que muestra datos de hace 15 segundos no sirve para operar: sirve para auditar.

Además, ese sondeo tiene un costo fijo aunque no pase nada, y no escala a notificaciones: para avisarle a una pantalla que algo ocurrió, hay que estar preguntando siempre.

## What Changes

- El servidor emite un evento por cada entrada nueva de bitácora, por comunidad.
- El dashboard se suscribe a ese flujo y recarga la tabla cuando llega un evento. La latencia baja de hasta 15 segundos a menos de uno.
- El sondeo queda como **respaldo** y baja a 30 segundos: si un evento se pierde, la tabla se corrige igual. Si el evento llegó, el tick de respaldo no cambia nada porque el total ya coincide.
- El tablero del guardia refresca también el historial de turnos cuando el evento es de apertura o cierre, que era el caso reportado.

El transporte es Server-Sent Events sobre HTTP, con un bus en memoria. Cuando haya más de una instancia de API, el bus pasa a Redis pub/sub sin tocar el cliente.

## Capabilities

### New Capabilities

- `live-bitacora-stream`: emisión de eventos de bitácora en el servidor, suscripción desde el dashboard y respaldo por sondeo.

### Modified Capabilities

Ninguna.

## Impact

- `server/api`: bus de eventos, publicación dentro de `insertBitacoraEntry` y ruta `GET /api/bitacora/stream`.
- `apps/dashboard`: hook `useBitacoraStream`, `AccessBitacoraView` y `GuardPanel`.
- Pruebas: Playwright del tablero del guardia.

## Fuera de alcance

- Notificaciones push a la app móvil (este evento es la base, pero el envío es otro change).
- Reemplazar el sondeo por completo: el respaldo se queda.
- Transporte entre instancias (Redis pub/sub) mientras haya una sola API.
