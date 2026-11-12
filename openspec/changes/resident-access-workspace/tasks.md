# Tasks: resident-access-workspace

## 1. Modelo de datos

- [x] 1.1 Agregar el valor `common_area` a `sectionTypeEnum` en `packages/database/src/schema/location-units.ts`.
- [x] 1.2 Agregar `batch_id` (uuid nullable) y `batch_label` (varchar 80 nullable) a `access_passes` con índice por `batch_id`.
- [x] 1.3 Generar y aplicar la migración; correr `pnpm --filter @porteria/database build`.
- [x] 1.4 Confirmar que `location_unit_id` y `structure_id` de `access_passes` siguen `NOT NULL`.

## 2. Tipos compartidos y esquemas

- [x] 2.1 Exportar en `packages/shared` `DestinationKind` (`home` | `common_area`), `DestinationSummary`, `PassBatchRequest` y `PassBatchResult`.
- [x] 2.2 Extender `createPassSchema` para aceptar un `locationUnitId` de cualquier nivel y validar el nivel en el servicio. El esquema ya aceptaba cualquier uuid; se documentó el contrato y la validación por nivel queda en 4.2 y 4.3.
- [x] 2.3 Crear `createPassBatchSchema` con el límite de 200 filas y `batchLabel` de hasta 80 caracteres.
- [x] 2.4 Extender el esquema de consulta de pases con `search`, `destinationUnitId` y `batchId`.
- [x] 2.5 Agregar `common_area` a `SECTION_TYPE_LABELS` como `Zona común`.

## 3. Lugares comunes en el árbol

- [x] 3.1 Aceptar `common_area` en el alta y edición de nivel 1 en `location-nodes.routes` y `sections.routes`.
- [x] 3.2 Agregar el select de tipo de sección al alta de nivel 1 en `UnitsWorkspace`, con `Zona común` entre las opciones.
- [x] 3.3 Derivar el tipo por defecto del nombre del nivel (`Torre` → `tower`, `Piso` → `floor`, `Casa` → `house`, `Bloque` → `block`, `Lote` → `lot`, resto `other`).
- [x] 3.4 Mostrar el tipo de sección en el detalle expandido de la comunidad y en el diálogo de estructura.
- [x] 3.5 Traducir el rechazo por FK al eliminar una rama con pases a un 409 con mensaje claro.

## 4. API de pases con destino

- [x] 4.1 Resolver el ancestro de nivel 1 de un nodo y derivar `kind` (`home` | `common_area`).
- [x] 4.2 Validar el destino de vivienda: hoja, propia, fuera de una rama común.
- [x] 4.3 Validar el destino común: nodo activo dentro de una rama `common_area` de la comunidad, sin exigir hoja.
- [x] 4.4 Rechazar nodos archivados con 400 `destination_inactive` y nodos de otra comunidad con 404.
- [x] 4.5 Incluir `destination: { id, name, path, kind }`, `batchId` y `batchLabel` en `GET /api/passes` y `GET /api/passes/:id`.
- [x] 4.6 Aplicar `search`, `status`, `destinationUnitId` y `batchId` en la consulta de historial.
- [x] 4.7 Guardar el destino en la bitácora y en la respuesta de escaneo del guardia.
- [x] 4.8 Implementar `POST /api/passes/batch` con transacción única, `batch_id` compartido y reporte de rechazos.
- [x] 4.9 Agregar el endpoint que lista los destinos autorizables de la comunidad para el residente (viviendas propias + ramas comunes activas).

## 5. Workspace del residente

- [x] 5.1 Quitar la redirección a `/app-required` para `owner`, `tenant` y `resident` en `HomePage`.
- [x] 5.2 Agregar las rutas `/resident`, `/resident/authorizations`, `/resident/authorizations/new` y `/resident/authorizations/bulk` con `RequireRole`. (la ruta de carga masiva se agrega con la secci�n 7).
- [x] 5.3 Crear `ResidentLayout` con el header existente y un sidebar reducido (Inicio, Autorizaciones, Autorizar).
- [x] 5.4 Implementar el inicio con accesos rápidos, autorizaciones vigentes y estado vacío.
- [x] 5.5 Mostrar el mensaje neutral cuando el feature flag de QR dinámico está apagado.
- [x] 5.6 Verificar la navegación en 390x844 sin scroll horizontal de página.

## 6. Formulario de autorización

- [x] 6.1 Cargar destinos disponibles (viviendas propias + lugares comunes activos) al abrir el formulario. El selector arranca vacío a propósito: Radix limpia un valor controlado sin `SelectItem` montado, así que el residente elige el destino de forma explícita.
- [x] 6.2 Implementar el selector agrupado `Mi vivienda` / `Zonas comunes` con la ruta completa de cada opción.
- [x] 6.3 Implementar los campos de visitante, vehículo, tipo de pase y vigencia reusando los esquemas existentes.
- [x] 6.4 Implementar el paso de confirmación con resumen y navegación atrás sin perder datos. Resumen con visitante, documento, destino, vigencia, tipo y vehículo; `Volver` conserva todo lo cargado.
- [x] 6.5 Al guardar, navegar al historial con la fila nueva visible sin recargar.
- [x] 6.6 Mostrar errores de API por campo, incluido `destination_inactive`. Los códigos de pase se traducen al campo que los causó (`destination_inactive`, `not_found`, `foreign_community`, `forbidden`, `invalid`); el resto cae en el mensaje general.

## 7. Historial de autorizaciones

- [x] 7.1 Crear la tabla con visitante, destino, vigencia, estado y acciones.
- [x] 7.2 Implementar búsqueda, filtros de estado y destino, y paginación server-side.
- [x] 7.3 Derivar el estado `Vencida` cuando `valid_until` ya pasó y el pase sigue `active`.
- [x] 7.4 Implementar el diálogo de QR rotativo con refresco y corte al cerrar.
- [x] 7.5 Implementar copiar enlace, regenerar enlace y revocar con confirmación.
- [x] 7.6 Deshabilitar las acciones que no aplican según el estado del pase.
- [x] 7.7 Implementar el filtro por lote desde la etiqueta del historial.
- [x] 7.8 Implementar estados de carga, vacío y error con reintento.

## 8. Carga masiva

- [x] 8.1 Crear la página de carga masiva con input de archivo, textarea y descarga de plantilla.
- [x] 8.2 Implementar el parser CSV tolerante a mayúsculas y espacios en los encabezados.
- [x] 8.3 Validar encabezados, filas, duplicados internos, pases activos y el límite de 200.
- [x] 8.4 Implementar la vista previa con válidas, inválidas y motivos por fila.
- [x] 8.5 Invalidar la vista previa al cambiar destino o vigencia.
- [x] 8.6 Enviar el lote a `POST /api/passes/batch` y mostrar creadas y rechazadas.
- [x] 8.7 Enlazar el resultado con el historial filtrado por lote.

## 9. Verificación

- [ ] 9.1 Correr `tsc --noEmit` en dashboard y API.
- [ ] 9.2 Correr la suite de integración de la API con los casos de destino común interno, vivienda de otro residente y lote.
- [ ] 9.3 Crear `tests/resident-access.spec.ts` con ingreso del residente, alta de autorización, destino de lugar común, historial y revocación.
- [ ] 9.4 Agregar al spec el alta de una rama `Zona común` desde `Unidades` y su aparición en el selector del residente.
- [ ] 9.5 Agregar el caso de carga masiva con archivo válido y con filas inválidas.
- [ ] 9.6 Ajustar los specs que hoy esperan `/app-required` para residentes.
- [ ] 9.7 Correr Playwright completo.
- [ ] 9.8 Aplicar Prettier y validar el change con `openspec validate resident-access-workspace --strict`.
- [ ] 9.9 Verificar que el dashboard no rompa el canal de la app: un pase creado por API con el mismo usuario sigue visible en el historial y el ingreso web no revoca enlaces ni sesiones.
