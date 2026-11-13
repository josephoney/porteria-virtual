# Reglas de autorización por comunidad

## Why

El límite de autorizaciones por día vive en una variable de entorno global (`PASS_DAILY_LIMIT_PER_UNIT`) con el mismo valor para todas las comunidades. Tiene tres problemas:

1. **No se puede desactivar.** Una comunidad chica no necesita límite; una grande con muchos residentes sí. Hoy ambas reciben el mismo trato.
2. **El administrador no lo ve.** No hay ningún lugar de la interfaz donde figure el número, así que el residente descubre el límite cuando el alta falla con `daily_limit_reached`.
3. **Cambiarlo requiere reiniciar el servicio.** Es una variable de entorno, no un dato de la comunidad.

Un residente que organiza una reunión familiar y autoriza siete visitas en un día no debería chocar con un número que nadie eligió para su edificio.

## What Changes

- La comunidad gana dos datos: si el límite está habilitado y cuál es el número. Por defecto **habilitado con 50**, que es el valor que hoy usa el entorno.
- El formulario de alta y de edición de comunidad suma una sección **Reglas** con el interruptor y el número.
- El alta de autorizaciones lee la regla de la comunidad en lugar de la configuración global.
- Si el límite está deshabilitado no se cuenta nada: desaparece la consulta de conteo.
- El rechazo sigue siendo `daily_limit_reached`, pero ahora informa el máximo vigente para esa comunidad.
- `PASS_DAILY_LIMIT_PER_UNIT` queda como interruptor global de emergencia: en `0` desactiva el límite en todas las comunidades, útil para pruebas y para una cuenta de demostración.

La carga masiva sigue sin aplicar el límite: un lote de hasta 200 visitas es una decisión administrativa explícita, no una autorización individual suelta.

## Capabilities

### New Capabilities

- `community-pass-rules`: regla de límite diario por comunidad, su configuración desde la administración y su aplicación al alta de autorizaciones.

### Modified Capabilities

Ninguna.

## Impact

- `packages/database`: dos columnas nuevas en `communities` y su migración.
- `packages/shared`: tipos de la regla y del detalle de comunidad.
- `server/api`: esquemas de alta y edición de comunidad, persistencia, y `createPass` leyendo la comunidad.
- `apps/dashboard`: sección Reglas en el formulario de comunidad y el número en el detalle expandido.
- Pruebas: integración de pases y Playwright del formulario de comunidad.

## Fuera de alcance

- Límites por unidad, por residente o por tipo de pase.
- Ventanas horarias o cupos por franja.
- Historial de cambios de la regla (quién la modificó y cuándo).
- Aplicar el límite a la carga masiva.
