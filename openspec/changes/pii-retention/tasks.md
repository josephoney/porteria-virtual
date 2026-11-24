## 1. Datos

- [ ] 1.1 Agregar `retention_months` a `organizations` (entero, `NOT NULL`,
      default 12, entre 1 y 60) con la migración correspondiente.
- [ ] 1.2 Crear `retention_runs`: organización, fecha, ventana aplicada, filas
      anonimizadas por tabla y bandera de simulación; índice por organización y
      fecha.
- [ ] 1.3 Dejar constancia en el esquema de que la organización es la
      responsable del dato y que la ventana es su decisión.

## 2. Anonimización

- [ ] 2.1 Servicio `anonymizeOrganization(organizationId, months, { dryRun })`
      que devuelve los conteos por tabla sin escribir cuando `dryRun` es true.
- [ ] 2.2 Pases: reemplazar nombre, apellido, documento, placa y acompañantes
      por la marca de anonimizado; conservar fechas, estado, comunidad y unidad.
- [ ] 2.3 Escaneos: mismo tratamiento sobre las columnas del visitante;
      conservar acción, resultado, motivo, portería y turno.
- [ ] 2.4 Bitácora: quitar `visitor`, `companions`, `vehiclePlate` y
      `authorizedByName` del payload de detalles; conservar tipo, origen,
      resultado y horas.
- [ ] 2.5 No tocar `people`, `accounts` ni sus datos de contacto.
- [ ] 2.6 Registrar el resumen de cada corrida en `retention_runs`, también
      cuando fue simulación.

## 3. Ejecución programada

- [ ] 3.1 Worker con barrido periódico, intervalo configurable y apagado por
      variable de entorno.
- [ ] 3.2 Escritura deshabilitada por defecto: sin
      `RETENTION_WRITE_ENABLED=true` el barrido sólo informa.
- [ ] 3.3 Idempotencia: una segunda corrida sobre la misma ventana no encuentra
      filas pendientes.

## 4. API

- [ ] 4.1 `GET /api/organization/me` devuelve la ventana de retención vigente.
- [ ] 4.2 `PATCH /api/organization/me` acepta `retentionMonths` con validación
      de rango; sólo la administración de la organización y la de plataforma.
- [ ] 4.3 `GET /api/organization/me/retention-runs` devuelve el historial
      acotado a la organización del solicitante.
- [ ] 4.4 Aplicar la misma validación en la creación de organización desde la
      consola de plataforma.

## 5. Panel

- [ ] 5.1 Campo «Retención de datos» en el perfil de la organización, en meses,
      con el mínimo y el máximo visibles.
- [ ] 5.2 Texto que explique qué desaparece (nombre, documento, placa,
      acompañantes) y qué queda (tipo, resultado, hora, portería, turno).
- [ ] 5.3 Historial de corridas con fecha, ventana, filas anonimizadas y si fue
      simulación, con estado vacío cuando nunca corrió.

## 6. Tests

- [ ] 6.1 Integración: un pase, un escaneo y una entrada de bitácora fuera de
      la ventana quedan anonimizados; los de dentro de la ventana no.
- [ ] 6.2 Integración: el reporte del mismo período da los mismos totales antes
      y después de anonimizar.
- [ ] 6.3 Integración: `people` y `accounts` no cambian.
- [ ] 6.4 Integración: en simulación no se escribe ningún dato y el resumen lo
      informa.
- [ ] 6.5 Integración: una segunda corrida informa cero filas.
- [ ] 6.6 Integración: ventana inválida rechazada; historial acotado por
      organización.
- [ ] 6.7 Documentar la limitación conocida: los textos libres de la bitácora
      (resumen escrito por el guardia) no se anonimizan automáticamente.

## 7. Documentación y verificación

- [ ] 7.1 Actualizar `docs/produccion-checklist.md` (retención de datos y PII
      acordada) y `docs/mobile-release.md` (política de privacidad).
- [ ] 7.2 Sección de retención en `docs/runbook-produccion.md`: cómo simular,
      cómo habilitar, qué hacer si se anonimizó por error.
- [ ] 7.3 Suites unitarias e integración en verde, `tsc` limpio y prettier en
      los archivos tocados.
- [ ] 7.4 Smoke en staging: cambiar la ventana, correr en simulación y revisar
      el historial.
