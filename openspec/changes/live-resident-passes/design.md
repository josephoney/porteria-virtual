# Design: live resident passes

## Context

El pase tiene un dueño (`createdByPersonId`). Su estado cambia por acciones que ocurren fuera de su pantalla: el guardia confirma o rechaza un escaneo, o el mismo residente revoca desde otra sesión. La pantalla del residente sólo se actualiza al montar, al cambiar un filtro o al recargar.

Ya existe el patrón del tablero del guardia: `bitacora-bus.ts` publica desde el único punto de escritura y la ruta `/api/bitacora/stream` entrega por SSE. Se repite el patrón, con una diferencia importante.

## Goals

- Latencia menor a un segundo entre el escaneo y el cambio en la pantalla del residente.
- Que un residente reciba **sólo** eventos de sus propios pases.
- Que si el stream falla, la pantalla siga funcionando con el sondeo de respaldo.

## Non-goals

- Push al teléfono. Eso necesita el servicio de notificaciones, que es otro change.
- Sincronizar la app móvil.

## Decisions

### 1. Bus propio, no reutilizar el de la bitácora

El bus de la bitácora emite por `communityId`. Si el residente se suscribe a ese stream, recibe eventos de movimientos de **toda** la comunidad: otros residentes, otras unidades, horas de ingreso. Aunque el payload no traiga datos personales, el simple hecho de recibir un evento revela que alguien entró por la portería.

`pass-bus.ts` emite `{ personId, passId, status }` y la suscripción filtra por `personId`. Un residente no puede pedir los eventos de otro porque el `personId` sale del token, no de la query.

### 2. Publicar en los servicios, no en las rutas

Igual que en la bitácora: se publica desde `revokePass`, `confirmScan` y `rejectScan`, que son los puntos donde el estado cambia de verdad. Publicar en la ruta dejaría afuera cualquier llamada interna.

### 3. El evento lleva el estado nuevo, no el pase completo

`{ personId, passId, status }` alcanza para que el cliente recargue o, si se quiere, actualice la fila. No se envían datos del visitante: si mañana el stream se expone a otro cliente, el payload no filtra PII.

### 4. SSE con `fetch` y `Bearer`

Misma razón que en la bitácora: `EventSource` no acepta headers y obligaría a poner el token en la URL.

### 5. Sondeo de respaldo de 30 segundos

El stream puede cortarse por un proxy o por suspensión del equipo. El historial consulta cada 30 segundos y sólo recarga si cambió el total, así que un tick sobre datos iguales no cuesta nada.

### 6. El inicio también escucha

Los «vigentes ahora» del inicio muestran los mismos pases. Si el residente está en el inicio cuando el guardia escanea, esa lista también tiene que cambiar. Se monta el mismo hook en `ResidentHomePage`.

## Risks

- **Conexiones abiertas por residente.** Cada pestaña del residente mantiene una conexión. Con muchos residentes simultáneos conviene pasar el bus a Redis pub/sub, igual que en la bitácora. Se anota en el archivo, no se resuelve acá.
- **Reconexión sin hueco.** Al reconectar se recarga la tabla completa, así que un evento perdido no deja la pantalla desactualizada.
