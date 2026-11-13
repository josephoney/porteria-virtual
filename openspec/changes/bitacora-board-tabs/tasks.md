# Tasks: Pestañas y paginación del tablero del guardia

## 1. Pestañas del tablero

- [x] 1.1 Verificar el tope de `pageSize` en `GET /api/guard/shifts` y, si es menor a 50, subirlo en el esquema y el servicio.
- [x] 1.2 Envolver las dos tablas de `GuardPanel` en una `Card` con `Tabs`: «Ingresos y salidas» (bitácora) y «Turnos» (historial).
- [x] 1.3 Dejar «Ingresos y salidas» como pestaña por defecto y asegurar que la otra no se muestra hasta seleccionarla (Radix la deja montada y oculta, así que la aserción del test es de visibilidad).
- [x] 1.4 Mantener el estado de página y tamaño de cada tabla independiente mientras el componente sigue montado.
- [x] 1.5 Agregar el filtro `types` y `excludeTypes` a `GET /api/bitacora` para que el tablero pida varios tipos o excluya algunos en una sola request.
- [x] 1.6 Excluir siempre `shift_start` y `shift_end` del tablero de ingresos y no ofrecerlos en el filtro de tipo: esos eventos viven en la pestaña Turnos. El filtro arranca en �Todos� y sólo ofrece los tipos de acceso y las novedades manuales.

## 2. Paginación de la bitácora

- [x] 2.1 Agregar estado `pageSize` en `AccessBitacoraView` con opciones 10, 35 y 50 y default 10.
- [x] 2.2 Mover los controles al encabezado de la tabla: selector de tamaño, indicador `Página X de Y · N movimientos` y flechas anterior/siguiente.
- [x] 2.3 Deshabilitar anterior en la primera página y siguiente en la última.
- [x] 2.4 Resetear la página a 1 al cambiar el tamaño o cualquier filtro.
- [x] 2.5 Mantener el `refreshToken` y el poll sin perder la página ni el tamaño elegidos.

## 3. Paginación del historial de turnos

- [x] 3.1 Llevar `page` y `pageSize` al estado de `GuardPanel` y pasarlos a `loadHistory`.
- [x] 3.2 Recargar el historial cuando cambian la página o el tamaño.
- [x] 3.3 Agregar los mismos controles que la bitácora, con el total que devuelve el endpoint.
- [x] 3.4 Caer a la última página disponible si la recarga devuelve menos páginas que la actual.

## 4. Alto acotado

- [x] 4.1 Limitar el contenedor de cada tabla con `max-h` y scroll interno, manteniendo el encabezado visible.

## 5. Verificación

- [x] 5.1 `pnpm --filter @porteria/dashboard exec tsc --noEmit` sin errores.
- [x] 5.2 Test de Playwright: pestañas visibles, cambio de pestaña sin apilar tablas, y que el historial no se renderice en la pestaña por defecto.
- [x] 5.3 Test de Playwright: cambiar el tamaño a 35 y verificar que el request use `pageSize=35` y que la página vuelva a 1.
- [x] 5.4 Test de Playwright: flechas de página en la bitácora, con anterior deshabilitado en la primera.
- [x] 5.5 Suite completa de Playwright en verde.
- [x] 5.6 `npx prettier --write` y `pnpm exec openspec validate bitacora-board-tabs --strict`.
