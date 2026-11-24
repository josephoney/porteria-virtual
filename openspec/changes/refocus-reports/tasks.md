## 1. Origen del acceso

- [ ] 1.1 Agregar `origin` a `pass_scans` (`qr` | `document`), con default `qr` y
      migración que backfillea los ingresos por documento desde el payload del
      evento (`source: 'manual_identity'`).
- [ ] 1.2 Registrar `document` en el camino de verificación por documento y `qr`
      en el escaneo de pase.
- [ ] 1.3 Tests: un ingreso por QR queda `qr`, uno por documento queda
      `document`, y los escaneos previos conservan un valor definido.

## 2. Reporte de accesos

- [ ] 2.1 Constructor de datos sobre `pass_scans` con el alcance del solicitante
      (comunidad, organización, plataforma) y los filtros de período.
- [ ] 2.2 Métricas: totales por resultado, ingresos y salidas por separado, por
      método, por portería, por hora, motivos de denegación ordenados y latencia
      media de confirmación (excluyendo los no confirmados).
- [ ] 2.3 Series diaria, semanal y mensual.
- [ ] 2.4 Tests de integración: los totales coinciden con los escaneos
      sembrados, las salidas no se suman a los ingresos, la falla de código no
      se cuenta como denegación y la latencia ignora los no confirmados.

## 3. Reporte de turnos

- [ ] 3.1 Constructor de datos sobre `guard_shifts` con el alcance del
      solicitante.
- [ ] 3.2 Métricas: turnos abiertos y cerrados, horas por guardia (un turno
      abierto no son cero horas) y accesos por turno y por guardia vía
      `shift_id`.
- [ ] 3.3 Listado de turnos sin cerrar, con guardia y hora de inicio.
- [ ] 3.4 Tests de integración: duración calculada desde el turno, turno abierto
      reportado como abierto, accesos atribuidos a su turno y accesos sin turno
      no atribuidos.

## 4. Exportación

- [ ] 4.1 Endpoint de exportación que recibe la familia de reporte, el período,
      el alcance y el formato, y reutiliza el mismo constructor que la pantalla.
- [ ] 4.2 Exportación CSV con comillas correctas y BOM UTF-8.
- [ ] 4.3 Exportación XLSX con encabezados, filas y totales.
- [ ] 4.4 Exportación PDF con título, período, alcance, totales y tablas.
- [ ] 4.5 Rechazar un formato desconocido sin producir archivo.
- [ ] 4.6 Tests: cada formato descarga, contiene las mismas métricas que la
      pantalla y respeta el alcance de un rol acotado.

## 5. Pantalla de reportes

- [ ] 5.1 Reemplazar el panel actual por las dos familias: Accesos y Turnos.
- [ ] 5.2 Quitar de la pantalla toda métrica de llamadas; los endpoints de
      llamadas quedan en el código sin uso desde la UI.
- [ ] 5.3 Acciones de exportación a CSV, XLSX y PDF con los filtros vigentes.
- [ ] 5.4 Estados de carga, vacío y error en cada familia.
- [ ] 5.5 Playwright: cada rol ve su alcance, las métricas de accesos y turnos
      renderizan y la exportación dispara la descarga.

## 6. Verificación

- [ ] 6.1 Suites unitarias e integración en verde.
- [ ] 6.2 Smoke manual en staging: reporte diario contra la bitácora del mismo
      día, turno abierto visible y exportación en los tres formatos.
