# Proposal: recurring pass schedules

## Why

Hoy un pase es una ventana única: desde una fecha y hora hasta otra, con una cantidad de usos en total. Eso no cubre dos casos reales:

- Un trabajador con horario establecido que viene lunes, miércoles y viernes hasta fin de mes.
- Alguien que hace una obra durante una semana, todos los días de 8 a 17.

En ambos el residente termina creando un pase por día, o uno enorme que deja entrar a cualquier hora. Ninguna de las dos es aceptable.

## What Changes

- Un pase declara **días y horario permitido**, no sólo un rango.
- Tres modalidades de repetición: **una sola vez**, **rango de días seguidos** y **días específicos cada semana hasta una fecha**.
- **Entrada y salida por defecto**, con una casilla opcional de sólo entrada.
- Los usos pasan a ser **por día**, no por pase.
- El guardia ve el motivo exacto cuando no corresponde: fuera de horario, día no autorizado, vencido o sin usos.

## Capabilities

### New Capabilities

- `pass-schedules`: cuándo puede usarse un pase y cuántas veces por día.

### Modified Capabilities

- `pass-usage-limits`: los usos dejan de ser totales y pasan a ser diarios.
- `resident-workspace`: el formulario de autorización pide días y horario.
- `guard-id-verification`: los mensajes de rechazo distinguen el motivo del horario.

## Impact

- `access_passes`: se habilitan `allowed_days`, `time_from` y `time_to`; se agrega `recurrence`. Sin migración de datos: las filas existentes quedan como `once`.
- `server/api/src/services/pass.service.ts` y `access-scan.service.ts`.
- Formularios del residente, pantalla del guardia y detalle en la bitácora.
- Cierra las tareas 15.1 a 15.4 de `add-dynamic-qr-access`, que quedan cubiertas por este change.

## Fuera de alcance

- Feriados y excepciones por calendario.
- Más de una ventana horaria por día.
- Pases por cantidad de horas (sólo por franja).
