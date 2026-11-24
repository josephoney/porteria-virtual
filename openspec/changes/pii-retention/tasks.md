## 1. Datos

- [x] 1.1 Agregar `retention_months` a `organizations` (entero, `NOT NULL`,
      default 12, entre 1 y 60) con la migración correspondiente.
- [x] 1.2 Crear `retention_runs`: organización, fecha, ventana aplicada, filas
      anonimizadas por tabla y bandera de simulación; índice por organización y
      fecha.
- [x] 1.3 Dejar constancia en el esquema de que la organización es la
      responsable del dato y que la ventana es su decisión.

## 2. Anonimización

- [x] 2.1 Servicio `anonymizeOrganization(organizationId, months, { dryRun })`
      que devuelve los conteos por tabla sin escribir cuando `dryRun` es true.
- [x] 2.2 Pases: reemplazar nombre, apellido, documento, placa y acompañantes
      por la marca de anonimizado; conservar fechas, estado, comunidad y unidad.
- [x] 2.3 Escaneos: mismo tratamiento sobre las columnas del visitante;
      conservar acción, resultado, motivo, portería y turno.
- [x] 2.4 Bitácora: quitar `visitor`, `companions`, `vehiclePlate` y
      `authorizedByName` del payload de detalles; conservar tipo, origen,
      resultado y horas.
- [x] 2.5 No tocar `people`, `accounts` ni sus datos de contacto.
- [x] 2.6 Registrar el resumen de cada corrida en `retention_runs`, también
      cuando fue simulación.
- [x] 2.7 Permitir la redacción de la bitácora sin abrir un agujero: la
      migración 0034 reescribe `prevent_bitacora_update()` para aceptar sólo el
      `UPDATE` que quita identidad y nada más. No estaba en el diseño original;
      sin esto la anonimización fallaba contra la inmutabilidad.
- [x] 2.8 Dejar fuera de la ventana el directorio `people`/`accounts` y la tabla
      legacy `visitors` (directorio, no registro de accesos); documentarlo.

## 3. Ejecución programada

- [x] 3.1 Worker con barrido periódico, intervalo configurable y apagado por
      variable de entorno.
- [x] 3.2 Escritura deshabilitada por defecto: sin
      `RETENTION_WRITE_ENABLED=true` el barrido sólo informa.
- [x] 3.3 Idempotencia: una segunda corrida sobre la misma ventana no encuentra
      filas pendientes.

## 4. API

- [x] 4.1 `GET /api/organization/me` devuelve la ventana de retención vigente.
- [x] 4.2 `PATCH /api/organization/me` acepta `retentionMonths` con validación
      de rango; sólo la administración de la organización y la de plataforma.
- [x] 4.3 `GET /api/organization/me/retention-runs` devuelve el historial
      acotado a la organización del solicitante.
- [x] 4.4 Aplicar la misma validación en la creación de organización desde la
      consola de plataforma.

## 5. Panel

- [x] 5.1 Campo «Retención de datos» en el perfil de la organización, en meses,
      con el mínimo y el máximo visibles.
- [x] 5.2 Texto que explique qué desaparece (nombre, documento, placa,
      acompañantes) y qué queda (tipo, resultado, hora, portería, turno).
- [x] 5.3 Historial de corridas con fecha, ventana, filas anonimizadas y si fue
      simulación, con estado vacío cuando nunca corrió.

## 6. Tests

- [x] 6.1 Integración: un pase, un escaneo y una entrada de bitácora fuera de
      la ventana quedan anonimizados; los de dentro de la ventana no.
- [x] 6.2 Integración: el reporte del mismo período da los mismos totales antes
      y después de anonimizar.
- [x] 6.3 Integración: `people` y `accounts` no cambian.
- [x] 6.4 Integración: en simulación no se escribe ningún dato y el resumen lo
      informa.
- [x] 6.5 Integración: una segunda corrida informa cero filas.
- [x] 6.6 Integración: ventana inválida rechazada; historial acotado por
      organización.
- [x] 6.7 Documentar la limitación conocida: los textos libres de la bitácora
      (resumen escrito por el guardia) no se anonimizan automáticamente.
- [x] 6.8 Integración: la bitácora sigue rechazando cualquier otro `UPDATE`
      después de la excepción de retención.

## 7. Documentación y verificación

- [x] 7.1 Actualizar `docs/produccion-checklist.md` (retención de datos y PII
      acordada) y `docs/mobile-release.md` (política de privacidad).
- [x] 7.2 Sección de retención en `docs/runbook-produccion.md`: cómo simular,
      cómo habilitar, qué hacer si se anonimizó por error.
- [x] 7.3 Suites unitarias e integración en verde, `tsc` limpio y prettier en
      los archivos tocados.
- [ ] 7.4 Smoke en staging: cambiar la ventana, correr en simulación y revisar
      el historial.
