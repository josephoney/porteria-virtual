# Proposal: Pestañas y paginación del tablero del guardia

## Why

El tablero de guardia (`/guard`) y la bitácora de Análisis apilan dos tablas completas: los
movimientos de acceso y el historial de turnos. Con datos reales, el usuario tiene que scrollear
una pantalla larguísima para llegar a la segunda tabla, y no hay forma de acotar cuántos
registros se ven. La bitácora además pagina de a 20 fijo, sin control visible: sólo dos botones
al pie.

Lo que se necesita: elegir qué tabla mirar sin scrollear, y controlar cuántos registros ver.

## What Changes

- Las dos tablas del tablero se separan en pestañas dentro de un contenedor: **Ingresos y
  salidas** y **Turnos**. Ver una no apila la otra.
- La bitácora gana un selector de registros por página (10, 35, 50) y flechas de anterior y
  siguiente, además del indicador de página actual.
- El historial de turnos deja de ser una lista fija de 20 y pasa a paginar contra el servidor
  con el mismo control.
- Las tablas se limitan al alto disponible de la página; el excedente se resuelve paginando, no
  estirando la pantalla.

## Capabilities

### New Capabilities

- `guard-board-tabs`: pestañas del tablero del guardia y controles de paginación compartidos.

### Modified Capabilities

Ninguna.

## Impact

- `apps/dashboard/src/components/guard/GuardPanel.tsx`: pestañas, estado de página y tamaño para
  el historial de turnos, reutilización de `loadHistory` con `page`/`pageSize`.
- `apps/dashboard/src/components/admin/AccessBitacoraView.tsx`: selector de tamaño y flechas.
- `server/api/src/routes/guard-shifts.routes.ts` y `server/api/src/services/guard-shift.service.ts`:
  verificar que `listShifts` acepte `pageSize` hasta 50 (hoy el tope puede ser menor).

Sin cambios de base de datos ni en `@porteria/shared`.

## Fuera de alcance

- Cambiar el modelo de datos de turnos o de bitácora.
- Filtros nuevos en la bitácora (los que hay siguen igual).
- Llevar las pestañas a la consola de plataforma.
