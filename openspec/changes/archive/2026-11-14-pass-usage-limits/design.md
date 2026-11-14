# Design: pass usage limits

## Context

`access_passes` ya guarda `entry_count` y `exit_count`, que se incrementan en cada movimiento. El `status` es un booleano efectivo (`active` / `used` / `revoked` / `expired`) que hoy se calcula de forma distinta en cada camino: el escaneo por QR marca `used` al salir de un pase de ida y vuelta, mientras que el ingreso por documento lo deja activo. Esa divergencia existe porque no hay una regla explícita de cuántos movimientos autoriza el pase.

## Goals

- Que el residente decida cuántas entradas y salidas autoriza.
- Una sola regla de consumo, igual para el QR y para la verificación por documento.
- Señalar los pases que no registraron salida.

## Non-goals

- Notificaciones push.
- Renovaciones automáticas o pases por franja horaria.

## Decisions

### 1. Un uso es un par entrada y salida

`maxUses = 2` significa dos entradas y dos salidas: cuatro movimientos. Contar entradas solamente haría que un visitante que entró y nunca salió consumiera dos usos, y el control de aforo se rompería.

El consumo se mide con `exit_count`, que ya existe: el par se completa al salir. La entrada no consume, sólo requiere que el pase no esté agotado y que la persona esté afuera.

### 2. `maxUses` es un dato del pase, no una regla de la comunidad

La cantidad de usos es una decisión del residente para esa visita concreta, no una política global. La comunidad ya tiene su regla diaria (`community-pass-rules`), que actúa en otro nivel: cuántos pases se crean por día, no cuántos movimientos permite cada uno.

### 3. El estado se deriva, no se guarda por separado

`entry_only` queda `used` cuando `entry_count >= 1`. `entry_exit` queda `used` cuando `exit_count >= maxUses`. Nada de un booleano paralelo que pueda desincronizarse.

Esto además cierra la divergencia entre el QR y el documento: hoy el mismo pase vence al salir por QR y no vence al salir por documento. Con la regla explícita, los dos caminos aplican lo mismo.

### 4. El pase de sólo entrada ignora `maxUses`

Se fuerza a 1 en la creación. Permitir `maxUses` en un pase sin salida no tendría sentido: la persona no puede volver a entrar sin haber salido.

### 5. La carga masiva lleva un `maxUses` para todo el lote

Un lote comparte destino, tipo y ventana; los usos son parte de esa misma decisión. Se aplica a cada pase creado, con 1 por defecto.

### 6. La alerta de salida faltante es persistida

Un worker corre cada pocos minutos y, para cada pase con `presence_state = 'inside'` cuya `valid_until` más `missingExitGraceMinutes` ya pasó, crea una alerta `missing_exit` si no existe una abierta. La salida la resuelve, como ya hace hoy.

Se eligió persistir en vez de calcular al vuelo por dos razones: deja rastro de cuándo se detectó, y permite que la bitácora muestre el badge aunque el pase se resuelva después.

La alerta se muestra como badge en el registro y en el detalle del pase. Cuando exista el servicio de notificaciones, se engancha el mismo evento sin cambiar el productor.

### 7. Límite de usos acotado

`maxUses` entre 1 y 20. Un pase de 200 usos en una jornada no es una autorización, es una puerta abierta, y el limitador diario de la comunidad no lo detectaría porque cuenta pases, no movimientos.

## Risks

- **Pases en curso al migrar.** Las filas existentes toman `max_uses = 1`, que es lo que hacían hasta ahora.
- **Aforo.** Permitir varios usos sube el tráfico de personas por pase; la alerta de salida faltante pasa a ser importante de verdad, no un adorno.
