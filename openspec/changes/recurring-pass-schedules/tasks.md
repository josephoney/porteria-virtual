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
