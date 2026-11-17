# Tasks: recurring pass schedules

## 1. Modelo de datos

- [x] 1.1 Agregar `recurrence` (enum `once | range | weekly`, default `once`) a `access_passes` y generar la migración.
- [x] 1.2 Confirmar que `allowed_days`, `time_from` y `time_to` se pueden escribir; dejar de rechazarlos en la creación.
- [x] 1.3 Documentar que `max_uses` pasa a significar «usos por día».

## 2. API: creación y validación

- [ ] 2.1 Aceptar `recurrence`, `allowedDays` y la ventana `timeFrom`/`timeTo` en `createPassSchema`, con validaciones cruzadas por modalidad.
- [ ] 2.2 Exigir `allowedDays` no vacío cuando `recurrence = weekly`, y prohibirlo en las otras dos.
- [ ] 2.3 Validar `validUntil >= validFrom` y que la ventana horaria sea coherente.
- [ ] 2.4 En `confirmScan` y `confirmIdentityEntry`, evaluar en este orden: vigencia, día, horario, usos del día, con códigos distintos.
- [ ] 2.5 Calcular los usos del día contando escaneos confirmados en la fecha local de la comunidad.
- [ ] 2.6 Devolver en el detalle del pase la regla legible: modalidad, días, horario y usos restantes de hoy.

## 3. Dashboard del residente

- [ ] 3.1 Reemplazar el rango único por tres botones excluyentes de duración: Hoy, Mañana y Rango de días.
- [ ] 3.2 Con Hoy o Mañana se oculta el segundo campo de fecha; con Rango de días aparecen ambos.
- [ ] 3.3 Los botones fijan sólo las fechas: la ventana horaria queda independiente.
- [ ] 3.3.1 Con Hoy, casilla «Entrada inmediata» marcada por defecto: alidFrom es el instante de creación, sin redondeo.
- [ ] 3.3.2 Al desmarcarla, se habilita el selector de hora de entrada en cuartos; con Mañana y Rango el selector está siempre visible.
- [ ] 3.4 Selector de días de la semana, visible sólo en modalidad semanal.
- [ ] 3.5 Campos de horario permitido, con ayuda que explique que los usos son por día.
- [ ] 3.6 Minutos en pasos de quince: `step="900"` en la web y lista de opciones en la app.
- [ ] 3.7 Casilla «Sólo entrada», desmarcada por defecto.
- [ ] 3.8 Resumen en el paso de revisión con la regla completa en lenguaje natural.
- [ ] 3.9 Mostrar la regla en el historial y en el detalle expandido.

## 4. App del guardia

- [ ] 4.1 Mostrar en la candidata el horario y los usos restantes de hoy.
- [ ] 4.2 Traducir los códigos nuevos a mensajes con la regla concreta.
- [ ] 4.3 Mantener el flujo de entrada y salida por documento sin cambios.

## 5. Administración

- [ ] 5.1 Mostrar la regla de horario en la bitácora y en el detalle del pase.
- [ ] 5.2 Incluir el motivo en los rechazos registrados.

## 6. Cierre de `add-dynamic-qr-access`

- [x] 6.1 Marcar 15.1 a 15.4 como cubiertas por este change.

## 7. Verificación

- [ ] 7.1 Integración: un pase semanal deja pasar en un día marcado y rechaza en uno no marcado.
- [ ] 7.2 Integración: fuera de la ventana horaria responde `out_of_schedule`.
- [ ] 7.3 Integración: los usos se reinician al día siguiente y se agotan dentro del mismo día.
- [ ] 7.4 Integración: un pase `once` existente sigue funcionando igual.
- [ ] 7.5 Playwright: el residente crea un pase semanal y el resumen lo describe bien.
- [ ] 7.6 `tsc`, `typecheck`, Prettier, `openspec validate --strict`.
- [ ] 7.7 Suite completa en verde y commit.

## Estado al retomar

Escrito al cerrar la sesión del 17/11. Leer esto antes de tocar código.

### Implementado y verificado

- `passRecurrenceEnum` (`once | range | weekly`) y columna `recurrence` en `access_passes`, migración `0022_typical_lord_tyger.sql` **aplicada**.
- `createPass` persiste `recurrence` y, en modalidad semanal, `allowedDays`.
- Se eliminó el rechazo `allowed_days_reserved`.
- `CreatePassDto` acepta `recurrence` y `allowedDays`.

### Brecha importante

**Nada lee `recurrence` al validar.** Un pase creado como `weekly` hoy se comporta igual que `once`: entra y sale sin mirar días ni horario. El cambio está a medias, no roto.

Además, `maxUses` sigue contándose **en total**. El spec lo redefine como usos **por día**. Mientras no se ajuste el conteo, un pase con dos usos se agota definitivamente después de dos salidas, no cada día.

### Trampa de drizzle encontrada

Al agregar un enum y usarlo en la misma migración, drizzle-kit generó sólo el `ALTER TABLE` y falló con `type "pass_recurrence" does not exist`. Hubo que agregar `CREATE TYPE` a mano al inicio del archivo. Si se regenera la migración, revisar que incluya el `CREATE TYPE`.

### Verificación previa a implementar

1. Leer `proposal.md`, `design.md` y `specs/pass-schedules/spec.md` completos, en ese orden.
2. Confirmar en la base que `access_passes.recurrence` existe y que los pases viejos quedaron en `once`.
3. Revisar `createPass` para ver qué campos llegan y cuáles se descartan.
4. Revisar `confirmScan` y `confirmIdentityEntry`: hoy validan vigencia y usos totales, no día ni horario.
5. Confirmar de dónde sale la timezone de la comunidad y que esté disponible en ambos caminos.

### Puntos que van a doler si se hacen rápido

- **Timezone**: comparar siempre contra la timezone de la comunidad, nunca la del servidor ni la del teléfono.
- **Día de la semana**: `0 = domingo`, como dice el spec.
- **Usos por día**: calcular contando `pass_scans` confirmados en la fecha local; no agregar un contador almacenado.
- **«Hoy»**: `validFrom` es el instante de creación con segundos, sin redondeo a cuarto.
