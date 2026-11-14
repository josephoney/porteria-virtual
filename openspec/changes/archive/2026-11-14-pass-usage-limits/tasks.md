# Tasks: pass usage limits

## 1. Modelo de datos

- [x] 1.1 Agregar `maxUses` (`max_uses`, integer not null default 1) a `access_passes` y generar la migración.
- [x] 1.2 Verificar que las filas existentes quedan en 1 y que el índice de consultas por estado sigue usando los campos actuales.

## 2. API: creación y consumo

- [x] 2.1 Aceptar `maxUses` (1 a 20) en `createPassSchema` y forzarlo a 1 cuando el tipo es `entry_only`.
- [x] 2.2 Aceptar `maxUses` en `createPassBatchSchema` y aplicarlo a todos los pases del lote, con 1 por defecto.
- [x] 2.3 Calcular el estado derivado en un solo lugar: `entry_only` usado con `entry_count >= 1`; `entry_exit` usado con `exit_count >= maxUses`.
- [x] 2.4 En `confirmScan` y en `confirmIdentityEntry`, permitir la entrada mientras el pase no esté agotado y la persona esté afuera, y permitir la salida sólo si está adentro.
- [x] 2.5 Devolver `maxUses` y `remainingUses` en el detalle y en el listado de pases.

## 3. Worker de salidas faltantes

- [x] 3.1 Crear `server/api/src/workers/pass-alerts.worker.ts` que cada `PASS_ALERT_INTERVAL_MINUTES` busque pases `inside` con `valid_until + missingExitGraceMinutes` vencido.
- [x] 3.2 Crear la alerta `missing_exit` sólo si no hay una abierta para ese pase, y registrar el movimiento en la bitácora.
- [x] 3.3 Arrancar y detener el worker con el servidor, respetando un flag de configuración para poder apagarlo en tests.
- [x] 3.4 Resolver las alertas abiertas al registrar la salida por cualquier camino (ya ocurre en el escaneo; extenderlo al documento).

## 4. Dashboard

- [x] 4.1 Agregar el campo «Usos permitidos» al formulario de autorización, visible sólo para ida y vuelta, con 1 por defecto.
- [x] 4.2 Agregar el mismo campo a la carga masiva y enviarlo en el lote.
- [x] 4.3 Mostrar en el historial del residente cuántos usos quedan (`1 de 2`).
- [x] 4.4 Mostrar el badge de salida faltante en la bitácora y en el detalle del pase.

## 5. App del guardia

- [x] 5.1 Mostrar en la candidata los usos restantes y ajustar el botón: entrada si está afuera y le quedan usos, salida si está adentro, deshabilitado si se agotó.
- [x] 5.2 Bloquear la entrada cuando la persona está adentro y la salida cuando está afuera, con mensajes distintos por caso.

## 6. Verificación

- [x] 6.1 Integración: un pase de dos usos permite entrar y salir dos veces y rechaza el tercer intento. Cubierto en `identity-verification.integration.test.ts`.
- [x] 6.2 Integración: un pase de sólo entrada se consume con la primera entrada aunque se envíe `maxUses` mayor. Cubierto en `identity-verification.integration.test.ts`.
- [x] 6.3 Integración: el worker crea una sola alerta para un pase que no salió, y no marca a quien sigue adentro ni a quien ya salió. Cubierto en `pass-alerts.integration.test.ts`.
- [x] 6.4 Playwright: el residente crea una autorización con dos usos y el historial muestra el saldo.
- [x] 6.5 `tsc` de API y dashboard, `typecheck` de la app, Prettier y `openspec validate --strict`.
- [x] 6.6 Suite completa en verde y commit.
