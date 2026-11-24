## 1. Origen del acceso

- [x] 1.1 Agregar `origin` a `pass_scans` (`qr` | `document`), con default `qr`.
      La migración incluye un backfill defensivo desde el payload del evento
      (`source: 'manual_identity'`), pero en este código no existen eventos de
      verificación por documento: la consulta deja todo en `qr`.
- [x] 1.2 Registrar el método del acceso según la realidad del registro: todo
      escaneo de pase es QR (`origin: 'qr'` en `pass_scans`) y la verificación
      por documento se informa desde `bitacora_entries.source = 'manual_identity'`.
      **No existe un escaneo que registrar para el documento**: esa vía sólo
      escribe bitácora porque `pass_scans` exige un `token_jti` que sólo tiene
      el QR. No se inventó una fila de escaneo.
- [x] 1.3 Tests: los escaneos de pase quedan `qr`; el ingreso por documento se
      cuenta con método `document` desde la fuente de la bitácora y no tiene
      `pass_scan_id`; los escaneos previos conservan un valor definido.

## 2. Reporte de accesos

- [x] 2.1 Constructor de datos sobre `bitacora_entries` con el alcance del
      solicitante (comunidad, organización, plataforma) y los filtros de período.
      Incluye `pass_entry`, `pass_exit`, `pass_rejected`, `scan_denied` y
      `manual`; excluye los eventos de turno.
- [x] 2.2 Métricas: totales por resultado (`authorized`, `denied`, `code_failure`,
      `observation`), ingresos y salidas por separado, por método (`source`),
      por portería, por hora, motivos de denegación ordenados y latencia media
      de confirmación con su cobertura (sólo accesos con escaneo QR confirmado).
- [x] 2.3 Series diaria, semanal y mensual.
- [x] 2.4 Tests de integración: los totales coinciden con las filas sembradas
      de la bitácora, el ingreso por documento cuenta como acceso, las salidas
      no se suman a los ingresos, la falla de código no se cuenta como
      denegación y la latencia ignora los accesos sin escaneo confirmado.

## 3. Reporte de turnos

- [x] 3.1 Constructor de datos sobre `guard_shifts` con el alcance del
      solicitante.
- [x] 3.2 Métricas: turnos abiertos y cerrados, horas por guardia (un turno
      abierto no son cero horas) y accesos por turno y por guardia vía
      `bitacora_entries.shift_id`.
- [x] 3.3 Listado de turnos sin cerrar, con guardia y hora de inicio.
- [x] 3.4 Tests de integración: duración calculada desde el turno, turno abierto
      reportado como abierto, accesos atribuidos a su turno desde la bitácora,
      incluido el ingreso por documento, y accesos sin turno no atribuidos.

## 4. Exportación

- [x] 4.1 Endpoint `GET /api/reports/export?report=access|shifts&format=csv|xlsx|pdf`
      con el período, la granularidad y el alcance; usa los mismos constructores
      que la pantalla (`getAccessReport` / `getShiftReport`).
- [x] 4.2 Exportación CSV con comillas RFC y BOM UTF-8; los números salen con
      punto decimal para que Excel los lea como números.
- [x] 4.3 Exportación XLSX real (`exceljs`): una hoja por sección, encabezados en
      negrita y totales.
- [x] 4.4 Exportación PDF (`pdfkit`, sin Chromium): título, período, alcance,
      totales y tablas con encabezado repetido al cortar de página.
- [x] 4.5 Rechazar un formato o un reporte desconocido con `400` sin producir
      archivo.
- [x] 4.6 Tests: cada formato descarga con su tipo de contenido, el CSV contiene
      las mismas métricas que el endpoint de la pantalla y el rol acotado no
      filtra otra comunidad.

## 5. Pantalla de reportes

- [x] 5.1 Reemplazar el panel actual por las dos familias: Accesos y Turnos.
- [x] 5.2 Quitar de la pantalla toda métrica de llamadas; los endpoints de
      llamadas quedan en el código sin uso desde la UI.
- [x] 5.3 Acciones de exportación a CSV, XLSX y PDF con los filtros vigentes.
- [x] 5.4 Estados de carga, vacío y error en cada familia.
- [x] 5.5 Playwright: cada rol ve su alcance, las métricas de accesos y turnos
      renderizan y la exportación dispara la descarga.

## 6. Verificación

- [x] 6.1 Suites unitarias e integración en verde.
- [ ] 6.2 Smoke manual en staging: reporte diario contra la bitácora del mismo
      día, turno abierto visible y exportación en los tres formatos.
