# Design: Bitácora en vivo

## Context

`GuardPanel` y `AccessBitacoraView` muestran la bitácora de la comunidad. Hoy sólo hay dos formas de actualizarla: el sondeo cada 15 segundos y el botón «Actualizar». El sondeo pide `pageSize=1` (~685 bytes) y sólo recarga la tabla si el total cambió.

El problema medido: abrir o cerrar un turno desde la app del guardia no aparece hasta apretar el botón. El sondeo no lo detecta porque `AccessBitacoraView` se monta con un `accessPointId` fijo y el turno cambia de estado sin cambiar el total de la primera página… y porque 15 segundos en un panel de operación son una eternidad.

## Goals

- Que un movimiento de bitácora aparezca en el dashboard en menos de un segundo.
- Que perder un evento no deje la tabla desactualizada para siempre.
- Que el mismo evento sirva después para notificar a la app.

## Non-goals

- Notificaciones push.
- Transporte distribuido entre instancias.
- Bitácora colaborativa en tiempo real (dos personas viendo lo mismo con cursores).

## Decisions

### 1. SSE con `fetch` en lugar de `EventSource`

`EventSource` no acepta el header `Authorization`, y poner el JWT en la query lo deja en logs, historial y referrers. Se usa `fetch` con `ReadableStream` y se parsean los frames a mano: son tres líneas por evento.

Alternativa descartada: WebSocket. El flujo es unidireccional y SSE reconecta solo; un WebSocket agregaría handshake y reconexión manual sin beneficio.

### 2. El bus vive en memoria y se cambia cuando haga falta

`bitacora-bus.ts` es un `EventEmitter` con `setMaxListeners(0)`. Con una sola instancia de API alcanza y sobra. El día que haya dos, el mismo módulo pasa a publicar y suscribir por Redis sin tocar el cliente ni las rutas.

### 3. Se publica en `insertBitacoraEntry`, no en las rutas

Ese es el único punto por donde se escribe la bitácora: escaneos, decisiones, turnos y novedades manuales. Publicar ahí garantiza que ningún llamador futuro se olvide de notificar.

### 4. El respaldo de 30 segundos se queda

Un stream puede perderse por un proxy, un reinicio del servidor o una pestaña suspendida. El tick de respaldo compara el total y sólo recarga si cambió, así que sobre una tabla al día no hace nada. Bajarlo de 15 a 30 segundos es seguro justamente porque el stream cubre el caso normal.

### 5. El tablero del guardia escucha los eventos de turno

El reporte del usuario era concreto: abrir y cerrar turno no se reflejaba. El historial de turnos vive en `GuardPanel`, separado del componente de bitácora, así que el panel se suscribe y filtra `shift_start` y `shift_end` para recargar sólo esa tabla.

### 6. Un `AbortController` y reconexión con espera fija

Al desmontar se aborta el `fetch`, se limpia el timer y se cierra el lector. La reconexión espera 3 segundos y vuelve a intentar; no hay backoff exponencial porque el escenario es un reinicio de servidor, no una caída larga, y una espera fija es más simple de razonar.

## Risks

- **Un evento por entrada**: si la bitácora recibe ráfagas (importaciones masivas), el cliente recarga varias veces. Hoy la escritura es de a una; si aparece una importación, se agrupa con un debounce en el cliente.
- **Conexiones abiertas**: cada pestaña mantiene una conexión. Un proxy con límite bajo o sin `X-Accel-Buffering: no` puede bufferear y arruinar la latencia; los headers ya lo contemplan.
- **Autenticación en el stream**: se resuelve por header, así que no hay tokens en URLs, pero el servidor debe cortar la conexión cuando el token expira. Hoy la conexión muere cuando el navegador la cierra o el token deja de servir para nuevas; el refresco de sesión no corta el stream abierto.
