# Proposal: pass usage limits

## Why

Hoy un pase es binario: está activo o está usado. No existe forma de autorizar a alguien para entrar y salir varias veces, y el residente no puede expresar «te autorizo dos visitas hoy» sin crear dos autorizaciones separadas.

Tampoco existe la alerta de salida faltante: la tabla `pass_alerts` y el tipo `missing_exit` están creados y la salida los resuelve, pero nada los genera. Un visitante que entró y no salió antes del cierre no aparece en ningún lado.

## What Changes

- `access_passes` gana `maxUses`: cuántos pares de entrada y salida autoriza la visita. Por defecto 1.
- Un **uso** es una entrada y una salida. Un pase de ida y vuelta con `maxUses = 2` permite dos pares y vence al completar el segundo.
- El pase de solo entrada ignora `maxUses`: se consume con la primera entrada.
- El estado del pase se deriva de los contadores que ya existen (`entry_count`, `exit_count`) contra `maxUses`, no de un booleano.
- El residente elige los usos al crear la autorización, y la carga masiva lo aplica a todo el lote. Sin indicarlo, es un uso.
- Un worker revisa los pases que siguen adentro pasado su horario y crea una alerta `missing_exit`, que se ve como badge en el registro.

## Capabilities

### New Capabilities

- `pass-usage-limits`: cuántos movimientos autoriza un pase y cuándo queda consumido.
- `missing-exit-alerts`: los pases que no registraron salida quedan señalados.

### Modified Capabilities

- `pass-destinations` y `resident-workspace`: el formulario y la carga masiva piden los usos.
- `guard-id-verification`: la entrada por documento respeta el contador en vez de asumir un solo uso.

## Impact

- Migración en `access_passes` (`max_uses`).
- `server/api/src/services/pass.service.ts` (creación individual y por lote), `access-scan.service.ts` (entrada y salida), nuevo worker de alertas.
- `apps/dashboard/src/pages/ResidentAuthorizationNewPage.tsx`, `ResidentAuthorizationBulkPage.tsx`, `ResidentAuthorizationsPage.tsx` y `AccessBitacoraView.tsx`.
- `apps/zima-qr-access/src/components/identity-check.tsx`.

## Fuera de alcance

- Notificaciones push: la alerta queda como badge hasta que exista el servicio de notificaciones.
- Pases recurrentes por día de la semana o por horario fijo.
