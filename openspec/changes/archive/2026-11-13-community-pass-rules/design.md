# Design: Reglas de autorización por comunidad

## Context

Hoy el límite diario por unidad es una sola variable de entorno leída en `server/api/src/config.ts`:

```ts
dailyLimitPerUnit: parseInt(process.env.PASS_DAILY_LIMIT_PER_UNIT || '50', 10),
```

`createPass` en `server/api/src/services/pass.service.ts` corta en seco si el valor es `0`, y si no cuenta los pases del día para `communityId + locationUnitId` usando la zona horaria de la comunidad:

```ts
if (config.passes.dailyLimitPerUnit > 0) {
  // count(*) since date_trunc('day', now() AT TIME ZONE timezone)
  if ((today?.count ?? 0) >= config.passes.dailyLimitPerUnit) {
    return { ok: false, code: 'daily_limit_reached' };
  }
}
```

El lote (`createPassBatch`) no pasa por este bloque a propósito: 20 contra un tope de 200 visitantes haría inservible la carga masiva.

`communities` ya tiene `timezone` (varchar 50, default `UTC`) y `welcomeMessage`, así que el patrón de "dato de configuración de la comunidad" existe y tiene lugar en el formulario actual.

## Goals

- Que cada comunidad decida si hay límite y con qué número.
- Que el número por defecto sea 50, sin cambiar el comportamiento de las comunidades existentes más que el valor.
- Que el administrador vea y edite la regla en el mismo formulario donde crea la comunidad.

## Non-goals

- Límites por unidad o por residente.
- Franjas horarias o cupos parciales.
- Auditoría de cambios de la regla.

## Decisions

### 1. Dos columnas en `communities`, no una regla genérica en JSON

`passDailyLimitEnabled` (boolean, `notNull`, default `true`) y `passDailyLimit` (integer, `notNull`, default `50`).

Alternativa descartada: un `settings` jsonb en `communities`. Sería más flexible, pero hoy hay una sola regla, y una columna tipada se valida en la base, se migra sin adivinar formas y se lee sin desarrollo. Cuando aparezca la tercera regla, se evalúa entonces.

Alternativa descartada: `passDailyLimit` nullable con `NULL` como "sin límite". Funciona, pero mezcla dos conceptos en un campo: "no configurado" y "deshabilitado". El interruptor explícito deja el número intacto cuando se desactiva, así reactivar no obliga a recordarlo.

### 2. El número se muestra aunque esté deshabilitado

El formulario mantiene el input visible y sólo lo deshabilita con el interruptor apagado. Borrarlo o esconderlo obliga a reescribir el número al reactivar.

### 3. La regla de la comunidad gana; el entorno queda como interruptor de emergencia

- Valor de la comunidad habilitado → se aplica `passDailyLimit`.
- Valor deshabilitado → no se cuenta.
- `PASS_DAILY_LIMIT_PER_UNIT=0` → desactiva en todas las comunidades, sin importar lo que diga cada una.

Se conserva porque las pruebas y las cuentas de demostración crean decenas de pases por corrida, y porque dar de baja una regla mal configurada en todas las comunidades sin tocar datos es una salida operativa razonable. Lo contrario (que el entorno pise el número) se descarta: dos fuentes para el mismo dato confunden.

### 4. Si el límite está deshabilitado, no hay consulta

El bloque de conteo queda dentro de `if (limitEnabled)`. Un `count(*)` menos por alta, y ningún riesgo de que un error de conteo bloquee una autorización que no tiene tope.

### 5. El error informa el máximo vigente

`sentPassError` sigue devolviendo `429` con `daily_limit_reached`, y el cuerpo suma `max` con el número de esa comunidad. El cliente ya traduce el código a un mensaje propio, así que agregar `max` no rompe nada y permite decir "llegaste a las 50 de hoy" en lugar de un genérico.

### 6. La carga masiva queda fuera

Se documenta en el spec en vez de dejarlo implícito en el código. Un lote es una acción administrativa deliberada con su propio tope de 200; aplicar el límite diario haría que un lote de 60 visitas fallara en la comunidad con límite 50, sin que el admin tenga forma de saberlo antes de subir el archivo.

### 7. Migración con valor por defecto, sin paso de datos

`ALTER TABLE communities ADD COLUMN ... DEFAULT 50 NOT NULL` deja las filas existentes con la regla habilitada en 50, que es exactamente el comportamiento actual tras subir el default del entorno. No hay ventana de inconsistencia ni script de backfill.

## Risks

- **Comunidades que hoy no llegan al límite** no notan nada; las que sí, pasan de 20 a 50 al desplegar. Es un cambio de comportamiento visible y deseado, pero conviene decirlo en las notas de versión.
- **Dos fuentes de verdad** (comunidad y entorno) mientras exista el interruptor global. Se mitiga dejándolo documentado como emergencia y no como configuración.
- **Playwright**: si el test de autorizaciones crea más de 50 pases para la misma unidad en una corrida, empieza a fallar. El `webServer` ya pasa `PASS_DAILY_LIMIT_PER_UNIT=0`, así que sigue cubierto.
