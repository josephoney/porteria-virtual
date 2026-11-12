# Tasks: resident-access-workspace

## 1. Modelo de datos

- [ ] 1.1 Agregar el enum `destination_kind` (`common_area`, `sport`, `recreation`, `other`) y el enum `destination_status` (`active`, `archived`) en `packages/database/src/schema`.
- [ ] 1.2 Crear la tabla `community_destinations` con `community_id`, `name`, `kind`, `description`, `status` y el índice único por comunidad y nombre normalizado.
- [ ] 1.3 Agregar `destination_id`, `batch_id` y `batch_label` a `access_passes` y hacer nullable `location_unit_id` y `structure_id`.
- [ ] 1.4 Agregar el check de destino excluyente y el índice `(community_id, status)` de destinos.
- [ ] 1.5 Generar y aplicar la migración; correr `pnpm --filter @porteria/database build`.
- [ ] 1.6 Agregar relaciones y tipos exportados para `community_destinations` y para las nuevas columnas de pases.

## 2. Tipos compartidos y esquemas

- [ ] 2.1 Exportar en `packages/shared` los enums de destino, `Destination`, `DestinationSummary` y los tipos de lote.
- [ ] 2.2 Extender `createPassSchema` para aceptar `locationUnitId` o `destinationId`, con validación de exclusividad.
- [ ] 2.3 Crear los esquemas de destino (`createDestinationSchema`, `updateDestinationSchema`) y el de lote (`createPassBatchSchema`) con el límite de 200.
- [ ] 2.4 Extender el esquema de consulta de pases con `search`, `destinationId` y `batchId`.

## 3. API de destinos

- [ ] 3.1 Implementar `GET /api/communities/:id/destinations` con filtro `includeArchived` para admins.
- [ ] 3.2 Implementar `POST /api/communities/:id/destinations` con validación de nombre único y 409 `destination_name_taken`.
- [ ] 3.3 Implementar `PATCH /api/destinations/:id` para nombre, tipo y descripción.
- [ ] 3.4 Implementar `POST /api/destinations/:id/archive` y `/restore`.
- [ ] 3.5 Implementar `DELETE /api/destinations/:id` con 409 si tiene pases asociados.
- [ ] 3.6 Aplicar `requireRole('org_admin','community_admin')` y el filtro por organización en todos los endpoints.
- [ ] 3.7 Exponer los destinos activos de la comunidad en el endpoint que consume el residente.

## 4. API de pases con destino

- [ ] 4.1 Resolver el destino en `pass.service`: vivienda propia o lugar activo de la comunidad de la membresía.
- [ ] 4.2 Validar el alcance del residente por `location_residents` con fallback a `memberships.locationUnitId`.
- [ ] 4.3 Rechazar destinos archivados con 400 `destination_inactive` y destinos de otra comunidad con 404.
- [ ] 4.4 Hacer que `buildLocationPath` y el armado de la respuesta toleren `location_unit_id` nulo y devuelvan `destination`.
- [ ] 4.5 Incluir `destination`, `locationPath`, `batchId` y `batchLabel` en `GET /api/passes` y `GET /api/passes/:id`.
- [ ] 4.6 Aplicar `search`, `status`, `destinationId` y `batchId` en la consulta de historial.
- [ ] 4.7 Guardar el destino en la bitácora y en la respuesta de escaneo del guardia.
- [ ] 4.8 Implementar `POST /api/passes/batch` con transacción única, `batch_id` compartido y reporte de rechazos.

## 5. Workspace del residente

- [ ] 5.1 Quitar la redirección a `/app-required` para `owner`, `tenant` y `resident` en `HomePage`.
- [ ] 5.2 Agregar las rutas `/resident`, `/resident/authorizations`, `/resident/authorizations/new` y `/resident/authorizations/bulk` con `RequireRole`.
- [ ] 5.3 Crear `ResidentLayout` con el header existente y un sidebar reducido (Inicio, Autorizaciones, Autorizar).
- [ ] 5.4 Implementar el inicio con accesos rápidos, autorizaciones vigentes y estado vacío.
- [ ] 5.5 Mostrar el mensaje neutral cuando el feature flag de QR dinámico está apagado.
- [ ] 5.6 Verificar la navegación en 390x844 sin scroll horizontal de página.

## 6. Formulario de autorización

- [ ] 6.1 Cargar destinos disponibles (vivienda + lugares activos) al abrir el formulario.
- [ ] 6.2 Implementar el selector de destino agrupado por tipo, con la ruta completa en las viviendas.
- [ ] 6.3 Implementar los campos de visitante, vehículo, tipo de pase y vigencia reusando los esquemas existentes.
- [ ] 6.4 Implementar el paso de confirmación con resumen y navegación atrás sin perder datos.
- [ ] 6.5 Al guardar, navegar al historial con la fila nueva visible sin recargar.
- [ ] 6.6 Mostrar errores de API por campo, incluido `destination_inactive`.

## 7. Historial de autorizaciones

- [ ] 7.1 Crear la tabla con visitante, destino, vigencia, estado y acciones.
- [ ] 7.2 Implementar búsqueda, filtros de estado y destino, y paginación server-side.
- [ ] 7.3 Derivar el estado `Vencida` cuando `valid_until` ya pasó y el pase sigue `active`.
- [ ] 7.4 Implementar el diálogo de QR rotativo con refresco y corte al cerrar.
- [ ] 7.5 Implementar copiar enlace, regenerar enlace y revocar con confirmación.
- [ ] 7.6 Deshabilitar las acciones que no aplican según el estado del pase.
- [ ] 7.7 Implementar el filtro por lote desde la etiqueta del historial.
- [ ] 7.8 Implementar estados de carga, vacío y error con reintento.

## 8. Carga masiva

- [ ] 8.1 Crear la página de carga masiva con input de archivo, textarea y descarga de plantilla.
- [ ] 8.2 Implementar el parser CSV tolerante a mayúsculas y espacios en los encabezados.
- [ ] 8.3 Validar encabezados, filas, duplicados internos, pases activos y el límite de 200.
- [ ] 8.4 Implementar la vista previa con válidas, inválidas y motivos por fila.
- [ ] 8.5 Invalidar la vista previa al cambiar destino o vigencia.
- [ ] 8.6 Enviar el lote a `POST /api/passes/batch` y mostrar creadas y rechazadas.
- [ ] 8.7 Enlazar el resultado con el historial filtrado por lote.

## 9. Administración de lugares

- [ ] 9.1 Agregar el bloque "Lugares autorizables" al detalle expandido de la comunidad en `AdminPanel`.
- [ ] 9.2 Implementar el alta con nombre, tipo y descripción sin recargar la página.
- [ ] 9.3 Implementar editar, archivar, restaurar y eliminar con confirmación y conteo de uso.
- [ ] 9.4 Refrescar el bloque después de cada mutación y respetar los permisos por rol.

## 10. Verificación

- [ ] 10.1 Correr `tsc --noEmit` en dashboard y API.
- [ ] 10.2 Correr la suite de integración de la API con los casos de destino, alcance y lote.
- [ ] 10.3 Crear `tests/resident-access.spec.ts` con ingreso del residente, alta de autorización, destino de lugar común, historial y revocación.
- [ ] 10.4 Agregar el caso de carga masiva con archivo válido y con filas inválidas.
- [ ] 10.5 Ajustar los specs que hoy esperan `/app-required` para residentes.
- [ ] 10.6 Correr Playwright completo.
- [ ] 10.7 Aplicar Prettier y validar el change con `openspec validate resident-access-workspace --strict`.
