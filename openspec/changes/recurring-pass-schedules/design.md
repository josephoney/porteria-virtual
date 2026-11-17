# Design: recurring pass schedules

## Context

`access_passes` ya tiene `allowed_days`, `time_from` y `time_to`, reservados y rechazados al crear. La validación de escaneo revisa `valid_from` / `valid_until` y un límite diario por comunidad, pero no el horario del pase.

Los sistemas de control de acceso resuelven esto con tres capas: vigencia, días y horario, y usos. Las plataformas de visitas agregan las modalidades «una vez», «rango de días» y «recurrente semanal».

## Goals

- Que el residente describa un horario real sin crear un pase por día.
- Que el guardia entienda en una línea por qué no pasa.
- Reutilizar el esquema existente en vez de inventar uno nuevo.

## Decisions

### 1. Tres capas, tres preguntas

| Capa           | Pregunta                | Campos                                               |
| -------------- | ----------------------- | ---------------------------------------------------- |
| Vigencia       | ¿En qué período existe? | `valid_from`, `valid_until`                          |
| Días y horario | ¿Cuándo puede pasar?    | `recurrence`, `allowed_days`, `time_from`, `time_to` |
| Usos           | ¿Cuántas veces por día? | `max_uses`                                           |

Cada una se valida por separado y produce un motivo distinto. Eso es lo que permite mensajes claros en la puerta.

### 2. Una sola ventana horaria por día

Si el pase permite más de un uso, entrar y salir al mediodía ya está cubierto. Dos ventanas agregarían un editor de franjas que el residente no necesita y que el guardia no lee.

### 3. Tres modalidades, un solo control

`recurrence` toma tres valores:

| Valor    | Semántica                                          | `allowed_days` |
| -------- | -------------------------------------------------- | -------------- |
| `once`   | Una entrada y salida puntual dentro de la vigencia | nulo           |
| `range`  | Todos los días entre `valid_from` y `valid_until`  | nulo           |
| `weekly` | Sólo los días marcados, hasta `valid_until`        | máscara L–D    |

`weekly` con los siete días marcados equivale a `range`. Se acepta la redundancia porque el residente elige por intención, no por eficiencia, y el servidor no necesita normalizarlo.

### 4. Entrada y salida por defecto

El tipo pasa a ser una casilla: «Sólo entrada», desmarcada. Marcada, el pase se consume al entrar y no espera egreso. Es lo que el residente elige el 90% de las veces cuando piensa «viene y se va».

### 5. Los usos son por día

`max_uses` significa «pares de entrada y salida por día». El contador se calcula contando `pass_scans` confirmados del pase en la fecha local de la comunidad, no con un contador almacenado. Una fuente de verdad, sin dos números que se desincronicen.

El tiempo se evalúa en la **timezone de la comunidad**, no en la del servidor ni la del teléfono.

### 6. Orden de validación y mensajes

Del más general al más particular, para que el guardia reciba el motivo más útil:

1. Pase inexistente o revocado.
2. Fuera de vigencia (`valid_from` / `valid_until`).
3. Día no autorizado (`weekly` y el día actual no está marcado).
4. Fuera de horario (`time_from` / `time_to`).
5. Usos del día agotados.

Cada uno tiene su código y su texto: `not_valid_now`, `out_of_days`, `out_of_schedule`, `daily_uses_exhausted`. El guardia no ve la regla completa, ve el motivo y cuándo vuelve a poder.

### 7. Compatibilidad

Las filas existentes quedan con `recurrence = 'once'` y sin horario: se comportan exactamente como hoy. Ninguna migración de datos ni cambio de comportamiento para lo ya creado.

### 8. Tres botones en lugar de dos fechas

Elegir el rango con dos campos de fecha es correcto y lento: para autorizar a alguien hoy hay que abrir el calendario, elegir la fecha y repetirla en el segundo campo.

El residente elige primero la **duración**, con tres botones excluyentes:

| Botón             | Qué hace                                       |
| ----------------- | ---------------------------------------------- |
| **Hoy**           | Vigencia de hoy, sin segundo campo de fecha    |
| **Mañana**        | Vigencia de mañana, sin segundo campo de fecha |
| **Rango de días** | Aparecen las dos fechas                        |

Los botones fijan **sólo las fechas**; la ventana horaria sigue siendo independiente. Así «Hoy» no obliga a inventar una hora de fin: si el pase permite un uso, alcanza con el horario habitual.

El caso más frecuente —autorizar a alguien que viene ahora— pasa de seis interacciones a dos.

**«Hoy» arranca exactamente en el instante de creación**, sin redondear. Si el residente autoriza a las 15:43:05 y el visitante entra a las 15:43:36, ya puede pasar.

El redondeo a cuartos aplica **sólo a los selectores**, no a este valor automático. En el caso de «Hoy» el único selector de hora es el de salida; la entrada la pone el sistema con precisión de segundos.

La alternativa —vigencia desde el inicio del día— permitiría un ingreso anterior a la autorización, y eso es difícil de explicar cuando alguien pregunta «¿quién lo dejó entrar?».

### 9. Horas en pasos de quince minutos

Los selectores de hora sólo ofrecen `00`, `15`, `30` y `45` en los minutos.

Nadie autoriza a las 14:07. Los minutos arbitrarios son ruido: generan franjas que el guardia no puede recordar y que el residente elige por accidente al arrastrar el selector nativo.

En la web alcanza con `step="900"` en el input de tipo `time`; en la app móvil es una lista de opciones.

La restricción es de la interfaz, no del dato: `valid_from` se guarda con precisión de segundos cuando lo calcula el sistema («Hoy»), y el motor de validación compara instantes reales.

## Risks

- **Zona horaria.** Un error de una hora deja a gente afuera o adentro. La comparación va siempre contra la timezone de la comunidad.
- **Cambio de hora.** Con una ventana fija y sin feriados, el riesgo se limita a la hora del cambio; se documenta y se prueba con una fecha de cambio.
- **Complejidad del formulario.** Tres controles nuevos pueden abrumar. El diseño los agrupa por intención y deja el caso simple (una vez) como camino corto.
