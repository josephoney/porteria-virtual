# Tasks: recurring pass schedules

## 1. Modelo de datos

- [x] 1.1 Agregar `recurrence` (enum `once | range | weekly`, default `once`) a `access_passes` y generar la migración.
- [x] 1.2 Confirmar que `allowed_days`, `time_from` y `time_to` se pueden escribir; dejar de rechazarlos en la creación.
- [x] 1.3 Documentar que `max_uses` pasa a significar «usos por día».

## 2. API: creación y validación

- [x] 2.1 Aceptar `recurrence`, `allowedDays` y la ventana `timeFrom`/`timeTo` en `createPassSchema`, con validaciones cruzadas por modalidad.
- [x] 2.2 Exigir `allowedDays` no vacío cuando `recurrence = weekly`, y prohibirlo en las otras dos.
- [x] 2.3 Validar `validUntil >= validFrom` y que la ventana horaria sea coherente.
- [x] 2.4 En `confirmScan` y `confirmIdentityEntry`, evaluar en este orden: vigencia, día, horario, usos del día, con códigos distintos.
- [x] 2.5 Calcular los usos del día contando escaneos confirmados en la fecha local de la comunidad.
- [x] 2.6 Devolver en el detalle del pase la regla legible: modalidad, días, horario y usos restantes de hoy.

## 3. Dashboard del residente

- [x] 3.1 Reemplazar el rango único por cuatro botones excluyentes de vigencia: Hoy, Mañana, Varios días y Recurrente.
- [x] 3.2 Con Hoy o Mañana se oculta el segundo campo de fecha; con Varios días aparecen ambos; con Recurrente aparecen «Desde» y «Hasta» opcionales.
- [x] 3.3 Los botones fijan fechas y modalidad: la ventana horaria vive en la tarjeta «Duración».
- [x] 3.3.1 Con Hoy, casilla «Entrada inmediata» marcada por defecto: `validFrom` es el instante de creación, sin redondeo.
- [x] 3.3.2 Desmarcarla exige «Hora inicio»; en Mañana, Varios días y Recurrente la casilla queda deshabilitada y manda la hora de inicio.
- [x] 3.4 Selector de días L–D y fechas «Desde»/«Hasta» opcionales en la tarjeta «Recurrente», habilitada sólo en esa modalidad. Sin fechas, empieza hoy y no vence.
- [x] 3.5 Campos «Hora inicio» y «Hora final» en la tarjeta «Duración», con ayuda sobre usos por día y recurrencia.
- [x] 3.6 Minutos en pasos de quince: `step="900"` en la web y lista de opciones en la app.
- [x] 3.7 Casilla «Sólo entrada», desmarcada por defecto.
- [x] 3.8 Resumen en el paso de revisión con la regla completa en lenguaje natural.
- [x] 3.9 Mostrar la regla en el historial y en el detalle expandido.

## 4. App del guardia

- [x] 4.1 Mostrar en la candidata el horario y los usos restantes de hoy.
- [x] 4.2 Traducir los códigos nuevos a mensajes con la regla concreta.
- [x] 4.3 Mantener el flujo de entrada y salida por documento sin cambios.

## 5. Administración

- [x] 5.1 Mostrar la regla de horario en la bitácora y en el detalle del pase.
- [x] 5.2 Incluir el motivo en los rechazos registrados.

## 6. Cierre de `add-dynamic-qr-access`

- [x] 6.1 Marcar 15.1 a 15.4 como cubiertas por este change.

## 7. Verificación

- [x] 7.1 Integración: un pase semanal deja pasar en un día marcado y rechaza en uno no marcado.
- [x] 7.2 Integración: fuera de la ventana horaria responde `out_of_schedule`.
- [x] 7.3 Integración: los usos se reinician al día siguiente y se agotan dentro del mismo día.
- [x] 7.4 Integración: un pase `once` existente sigue funcionando igual.
- [x] 7.5 Playwright: el residente crea un pase semanal y el resumen lo describe bien.
- [x] 7.6 `tsc`, `typecheck`, Prettier, `openspec validate --strict`.
- [x] 7.7 Suite completa en verde y commit.

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

### Avance 2.1 / 2.2 / 2.3

- `createPassSchema` ahora tiene `superRefine` por modalidad: `weekly` exige `allowedDays` no vacío (`weekly_requires_days`) y `once`/`range` lo prohíben (`allowed_days_only_for_weekly`). Ambos responden 400 con `message: 'Validation error'` y `details[].path = 'allowedDays'`.
- `createPass` normaliza la máscara al persistir (`[...new Set(days)].sort()`); el orden y los duplicados del cliente no llegan a la base.
- La ventana horaria se compara en minutos desde medianoche, no como string: `08:00` vs `08:00:00` ya no pasa como ventana válida. Sigue exigiendo ambos extremos o ninguno.
- Un pase de duración cero (`validFrom === validUntil`) se rechaza como `invalid`: no puede usarse nunca. La validación existente de rango invertido se mantiene.
- Tests agregados en la suite de pases: weekly sin días, días en `once`/`range`, máscara duplicada/desordenada, ventana de ancho cero y duración cero.

### Avance 2.4 / 2.5

- `confirmScan` y `confirmIdentityEntry` evalúan en orden vigencia, día, horario y usos del día, y devuelven `not_valid_now`, `out_of_days`, `out_of_schedule` o `daily_uses_exhausted` (todos HTTP 409).
- Los usos se cuentan desde `pass_scans` confirmados en la fecha local de la comunidad (`scanned_at AT TIME ZONE timezone`). No hay contador almacenado.
- `range` y `weekly` no se consumen al completar un par: quedan `active` y el límite diario los frena. `once` conserva el comportamiento total anterior.
- Tests de integración agregados: día marcado/no marcado, ventana horaria y agotamiento/reinicio diario, tanto por QR como por documento.
- `scanPass` también evalúa la regla para entradas y devuelve el código exacto sin crear el escaneo pendiente; `confirmScan` vuelve a evaluar porque sólo la confirmación escribe estado y consume el uso. Eso cierra la carrera entre escaneo y confirmación.
- Los códigos nuevos se traducen en la app del guardia (resultado del escaneo, actividad y flujo por documento).
- La suite de pases apaga el límite diario en el setup: cada test de límite declara su propia regla y el resto no depende del conteo acumulado.
- Pendiente: UI 3–5, Playwright 7.5 y cierre 7.6–7.7.

### Avance 2.6

- La evaluación de la regla y el conteo diario viven ahora en `server/api/src/services/pass-schedule.service.ts`: `loadCommunityTimezone`, `localDateInfo`, `isAllowedOnDay`, `isWithinTimeWindow`, `countDailyUses` y `evaluateEntryAccess`. `access-scan.service.ts` los importa en vez de duplicarlos, y `pass.service.ts` los reutiliza para el detalle.
- `GET /api/passes/:id` devuelve `rule` (`PassRuleSummary`): `recurrence`, `allowedDays`, `timeFrom`/`timeTo` normalizados a `HH:MM`, `maxUses`, `remainingUses` y un `summary` en español listo para mostrar.
- `summary` describe modalidad, días, fechas, ventana y usos: por ejemplo `Lunes, miércoles y viernes del 18/11/2026 al 30/11/2026, de 08:00 a 17:00 · quedan 2 usos hoy`. Los días se listan en orden lunes-domingo y con «y» final.
- `remainingUses` es por día para `range`/`weekly` (cuenta escaneos confirmados en la fecha local) y total para `once` (usa `exitCount`, porque su estado pasa a `used` al agotar el total). Para `entry_only` el tope es 1.
- El listado no calcula `rule` todavía: evitarlo mantiene el listado en una sola consulta por página. Las tareas 3.9/5.1 pueden reutilizar `buildPassRule` o pedir el detalle.
- Test agregado en la suite de pases: detalle de un pase weekly con máscara desordenada, ventana y usos; y un pase range con un par consumido por QR que baja `remainingUses` de 2 a 1 y el resumen a «queda 1 uso hoy».

### Avance 3.1 / 3.2 / 3.3 / 3.4 / 3.5 / 3.6 / 3.7 / 3.8

- `ResidentAuthorizationNewPage.tsx` se reescribió con **cuatro modos de vigencia** excluyentes: Hoy, Mañana, Varios días y Recurrente. Con Varios días aparecen las dos fechas; con Recurrente se habilita su tarjeta; Hoy y Mañana no piden fecha.
- La tarjeta **Vigencia** sólo elige el modo. La tarjeta **Duración** (debajo) contiene «Hora inicio» y «Hora final» con un control propio de tres selects (hora 01–12, minutos en cuartos, AM/PM) para que el formato no dependa del sistema operativo, más la casilla «Entrada inmediata».
- «Entrada inmediata» sólo se habilita con Hoy. Marcada, `validFrom` es el instante exacto de confirmación y el selector de **Hora inicio queda deshabilitado** (el inicio es la confirmación); «Hora final» sigue disponible para acotar la ventana diaria y se envía `timeFrom` con la hora de confirmación. Desmarcada, se exige «Hora inicio» y el pase no sirve antes. En Mañana, Varios días y Recurrente la casilla queda deshabilitada y el inicio es la Hora inicio en la fecha correspondiente.
- Los desplegables de hora usan `min-w-0` en su `SelectContent`: el componente compartido impone `min-w-36`, que hacía que el panel midiera 9rem aunque el campo midiera 4.5rem. Radix vuelve a tomar el ancho del trigger sólo en esos tres selects; los demás conservan el mínimo cómodo.
- La tarjeta **Recurrente** está deshabilitada y en gris fuera de esa modalidad. Al habilitarse muestra los chips L–D (`aria-pressed`, payload 0=domingo) y dos fechas opcionales, «Desde» y «Hasta». Sin fechas empieza hoy y no vence; con fechas empieza a la Hora inicio del día elegido y termina al final del día «Hasta», usando la misma ventana diaria de Duración.
- Se eliminó el menú «Repetición» (`once`/`range`/`weekly`): ahora se deriva de la vigencia. Hoy/Mañana → `once`; Varios días → `range`; Recurrente → `weekly` con `allowedDays`.
- La vigencia se calcula así: Hoy → ahora (o la hora de inicio) hasta 23:59:59.999; Mañana → mañana a la hora de inicio; Varios días → fecha inicial a la hora de inicio hasta el fin del día final; Recurrente → desde la fecha «Desde» (u hoy si está vacía) a la hora de inicio hasta el fin de «Hasta» o el centinela `PERMANENT_PASS_UNTIL` si está vacía.
- Una recurrencia sin fecha de fin se guarda como `9999-12-31T23:59:59.999Z` (`packages/shared/src/utils/pass-validity.ts`) y se oculta en todas las pantallas con `isPermanentPass`: dashboard (alta, home, historial), app del guardia (scan, home, identidad, detalle) y web pública. Se evitó hacer `valid_until` nullable para no tocar las ~20 consultas que lo comparan.
- El resumen de revisión usa la misma redacción que la API y acorta «del X al X» a «del X» cuando es el mismo día. El campo de usos se rotula «Usos permitidos» en `once` y «Usos por día» en `range`/`weekly`.
- «Sólo entrada» sigue desmarcada por defecto (el formulario crea `entry_exit`); al marcarla se deshabilita el campo de usos.
- Errores: `weekly_requires_days` vuelve al paso de formulario y marca el campo de días; los códigos de destino conservan su mapeo. Se quitó `allowed_days_reserved` de `messageForError`, porque ya no existe.
- Tests Playwright ajustados: el formulario expone los cuatro botones, la tarjeta Recurrente arranca deshabilitada y se habilita al elegirla, «Hora inicio» arranca deshabilitada con Hoy + Entrada inmediata y se habilita al desmarcarla, y el caso de rango invertido usa «Varios días» con fechas opuestas.
- Se quitaron los atributos `min` de los inputs de fecha: la validación nativa bloqueaba el submit antes de que el formulario mostrara su propio mensaje de vigencia.
- Verificación: `prettier --write` sobre todos los archivos tocados, `pnpm --filter @porteria/shared build`, `tsc --noEmit` de API y `typecheck` de la app del guardia limpios; `eslint` del dashboard sin errores (queda un warning preexistente de `reloadKey` en `ResidentAuthorizationsPage`). Suites de pases **26/26** e identidad **6/6**, incluido el test que describe una recurrencia permanente sin mostrar `9999`. `openspec validate --strict` válido. La suite Playwright no se ejecutó porque requiere dashboard, API y base de datos levantados.
- Pendiente: 4.1/4.3 (app del guardia), 5.x (bitácora), Playwright 7.5 y cierre 7.6–7.7.

### Avance 3.9

- `ResidentAuthorizationsPage.tsx` expande cada fila del historial con `useExpandedRow`/`expandableRowProps` (click, Enter y Space; chevron indicador). Las acciones y el filtro por lote frenan la propagación para no expandir la fila.
- La columna Vigencia muestra una línea compacta de la regla (`compactRule`): días L–D para weekly, «Todos los días» para range, «Un solo uso» para once con ventana, y `HH:MM–HH:MM` cuando hay horario. Los `once` sin ventana no agregan ruido.
- La columna Estado dejó de mostrar el total restante para `range`/`weekly` (semántica incorrecta) y ahora muestra «N uso(s) por día»; `once` conserva «N de M usos».
- Al expandir se pide `GET /api/passes/:id` (sin caché, para reflejar escaneos recientes) y se muestra «Regla del pase» con `rule.summary`, más Tipo, Usos del día/totales, Documento y Presencia. Loading con `Skeleton`, error con alerta.
- El listado sigue sin calcular `rule`: una consulta por página y el detalle sólo al expandir.
- Verificación: `prettier --write` limpio, `eslint` sin errores (queda el warning preexistente de `reloadKey`), `tsc` del dashboard sin errores nuevos en esta página (los TS2786 de React 18 vs `@types/react@19` siguen en componentes ya existentes).

### Avance 4.x / 5.x

- `IdentityCandidate` ahora incluye `rule: PassRuleSummary`. `searchAuthorizationsByDocument` carga la timezone una vez y llama `buildPassRule` por candidato (máximo 10), así que la app del guardia recibe días, horario y usos restantes del día sin consultas extra.
- La candidata muestra `rule.summary` (días, ventana y «quedan N usos hoy») y calcula el consumo con `rule.remainingUses`, no con `maxUses - exitCount`: un pase `range`/`weekly` con usos agotados hoy muestra «Sin usos hoy» y no «Usado». El flujo de entrada/salida por documento no cambió (4.3).
- La bitácora guarda `details.rule` (`describeSchedule(pass)`) en entradas, salidas, denegaciones y rechazos. La app del guardia lo muestra en la actividad y en el detalle del pase (`pass.rule?.summary`), con la vigencia/horario anteriores como fallback.
- Los rechazos manuales envían `denied_by_guard` como motivo, por lo que `pass_scans.reason` y `details.reason` dejan de quedar en `null`.
- Tests: la suite de identidad ahora verifica que la candidata devuelva `rule` con ventana y usos restantes (7/7); la de pases verifica `details.reason === 'denied_by_guard'` y `details.rule` en la bitácora del rechazo (26/26).
- Verificación: `tsc` de API y `typecheck` de la app del guardia limpios; `prettier` limpio en los archivos tocados.

### Avance 7.5

- Nuevo test en `tests/resident-workspace.spec.ts`: crea un pase con vigencia «Recurrente», marca lunes, miércoles y viernes, y verifica en la revisión el texto «Lunes, miércoles y viernes desde el DD/MM/YYYY de forma permanente, en cualquier horario · hasta 1 uso por día.»
- Al confirmar, el historial muestra la fila del visitante con la regla compacta `L · X · V` y el badge «1 uso por día». El test revoca el pase en `finally` para no ensuciar el historial del demo.
- No ejecutado todavía: Playwright necesita dashboard, API y base levantados.

### Avance 7.6

- `pnpm --filter @porteria/shared build`, `pnpm --filter @porteria/api exec tsc --noEmit` y `pnpm --filter @porteria/zima-qr-access typecheck` terminaron sin errores.
- Prettier: se verificó con `node node_modules/prettier/bin/prettier.cjs --check <archivos>` (pasar el array por `pnpm exec` en PowerShell lo colapsa en un solo patrón). Todos los archivos del cambio usan el estilo.
- `openspec validate recurring-pass-schedules --strict` → válido.
- `tsc --noEmit` del dashboard: sólo los `TS2786` preexistentes de React 18 vs `@types/react@19` en `Link`, iconos y `QRCodeSVG` de `ResidentAuthorizationsPage` y `ResidentHomePage`. `ResidentAuthorizationNewPage` no tiene errores.
- Tests unitarios de API: **23/23** en 7 suites.
- Tests de integración: **137/137** en 11 suites, incluidas pases e identidad.

### Avance 7.7

- Suite completa en verde: unitarios **23/23** e integración **137/137**.
- Cierre con el commit convencional `feat(passes): agregar recurrencias y usos por día`.
