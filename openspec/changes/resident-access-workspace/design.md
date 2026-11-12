# Design: workspace de autorizaciones del residente

## Context

El dashboard (`apps/dashboard`) resuelve el post-login en `HomePage`: los roles `owner`, `tenant` y `resident` van a `/app-required`, una pantalla que explica que la app de residentes es Zima QR Access. `apps/resident` es un stub de 14 líneas, así que hoy el residente **no tiene** superficie web.

La API ya soporta casi todo lo necesario:

- `POST /api/passes` con `requireRole('owner', 'tenant', 'resident')`.
- `GET /api/passes` con filtros y alcance por membresía.
- `GET /api/passes/:id/qr` para el QR rotativo del residente autenticado.
- `POST /api/passes/:id/revoke` y `/:id/regenerate-link`.

Lo que falta es de modelo y de superficie:

- `createPassSchema` exige `locationUnitId` de una hoja, y `pass.service` valida que coincida con `memberships.locationUnitId`. No hay destino que no sea la vivienda.
- No existe catálogo de lugares comunes.
- No existe alta por lote.
- No existe UI.

## Goals

- Que un residente entre al dashboard y gestione sus autorizaciones sin salir a otra app.
- Que pueda autorizar a su vivienda **o** a un lugar común activo de su comunidad.
- Que pueda autorizar a muchas personas de una vez con un CSV y ver qué filas fallaron y por qué.
- Que el historial sea la vista principal: qué autorizó, a dónde, hasta cuándo y en qué estado.
- Reusar el QR rotativo, el enlace público y el binding de dispositivo ya especificados en `add-dynamic-qr-access`, sin duplicarlos.

## Non-goals

- Notificar al visitante por canales externos.
- Reservar amenidades, cobrar o controlar cupos.
- Cambiar el flujo del guardia ni el escaneo.
- Construir la app móvil del residente.

## Decisions

### 1. El residente vive en `apps/dashboard`, no en `apps/resident`

`apps/resident` es un stub sin router, sin auth y sin design system. Replicar ahí el shell, el tema y el cliente de API es más caro que agregar una superficie al dashboard, que ya tiene todo eso y comparte sesión.

`HomePage` deja de redirigir a `/app-required` para `owner`, `tenant` y `resident`: ahora va a `/resident`. `/app-required` queda solo como salida para roles sin superficie propia.

Rutas nuevas, todas detrás de `RequireAuth` + `RequireRole('owner','tenant','resident')`:

```
/resident                        Inicio
/resident/authorizations         Historial
/resident/authorizations/new     Autorizar una persona
/resident/authorizations/bulk    Autorización masiva
```

### 2. El residente tiene su propio layout, no el sidebar admin

El sidebar admin expone Comunidades, Unidades, Usuarios y Auditoría, que el residente no puede usar. Se crea `ResidentLayout` con el mismo `SiteHeader` y un sidebar reducido: Inicio, Autorizaciones, Autorizar. Reusa `DashboardLayout` solo en lo visual (header, tema, ancho), no en los ítems.

La identidad del workspace (`useWorkspace`) ya resuelve comunidad y logo, así que el header no cambia.

### 3. Los lugares comunes son una entidad propia, no nodos del árbol

Un lugar común no es una vivienda: no tiene pisos, no tiene residentes asociados y no participa del árbol de `location_units`. Meterlo en `location_units` obligaría a inventar un cuarto nivel y a relajar todas las validaciones de hoja.

Nueva tabla `community_destinations`:

```ts
communityDestinations = pgTable('community_destinations', {
  id: uuid('id').defaultRandom().primaryKey(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  kind: destinationKindEnum('kind').notNull().default('common_area'),
  description: varchar('description', { length: 240 }),
  status: destinationStatusEnum('status').notNull().default('active'),
  createdAt,
  updatedAt,
});
```

- `kind`: `common_area` (salón comunal, zona BBQ), `sport` (cancha, gimnasio), `recreation` (piscina, club house), `other`.
- Índice único `(community_id, lower(name))` para no duplicar "Piscina" con "piscina".
- Archivar, no borrar: un pase histórico debe seguir mostrando su destino. `DELETE` solo si nunca se usó.

### 4. El pase apunta a un destino, y el destino es excluyente

`access_passes` gana `destination_id` nullable y `location_unit_id` pasa a nullable. Regla:

```sql
CHECK (
  (location_unit_id IS NOT NULL AND destination_id IS NULL)
  OR (location_unit_id IS NULL AND destination_id IS NOT NULL)
);
```

- Vivienda: se sigue enviando `locationUnitId` como hoy. `destination_id` queda `NULL`.
- Lugar común: se envía `destinationId`. `location_unit_id` queda `NULL` y `structure_id` también, porque la estructura describe el árbol de viviendas.

`structure_id` hoy es `NOT NULL`; pasa a nullable por la misma razón. `pass.service.buildLocationPath` devuelve `null` para lugares y la UI muestra "Piscina · Torre Norte".

Se descarta un `destination_type` textual en el pase: dos columnas nullable con un CHECK expresan lo mismo con integridad referencial.

### 5. El residente puede autorizar a su vivienda y a cualquier lugar activo de su comunidad

Alcance del destino:

- **Vivienda**: unidades hoja donde el usuario tenga un `location_residents` activo. Si no tiene ninguna fila ahí, se acepta `memberships.locationUnitId` como fallback, que es lo que hoy usa `pass.service`.
- **Lugar común**: cualquier `community_destinations` con `status = 'active'` de la comunidad de la membresía activa.
- Un residente **no** puede autorizar a la vivienda de otro. La validación se hace en el servicio, no solo en el formulario.

El selector de destino en el formulario muestra primero "Mi vivienda" con la ruta (`Torre Norte · Torre 1 · Piso 3 · Apartamento 302`) y debajo los lugares agrupados por `kind`.

### 6. Historial primero, con acciones por fila

`/resident/authorizations` es la vista principal y la que abre el menú. Columnas: Visitante, Destino, Vigencia, Estado, Acciones.

- Búsqueda por nombre o documento.
- Filtros: estado (`active`, `used`, `revoked`, `expired`) y destino.
- Orden por `valid_from` descendente.
- Acciones icónicas con `aria-label`: `Ver QR de {visitante}`, `Copiar enlace de {visitante}`, `Regenerar enlace de {visitante}`, `Revocar autorización de {visitante}`.
- Revocar pide confirmación y explica que el QR deja de servir.
- El QR se muestra en un diálogo que refresca el token antes de los 24 s, igual que el resto del sistema.

### 7. Carga masiva: CSV pegado o subido, un destino y una ventana

Formato mínimo, con encabezados obligatorios:

```csv
nombre,apellido,documento,placa
Ana,Pérez,10203040,
Luis,Gómez,10203041,ABC123
```

- Se acepta archivo `.csv` o texto pegado en un textarea.
- Un solo destino, un solo `type` y una sola ventana `validFrom`/`validUntil` para todo el lote. Así una fiesta es un formulario, no N.
- Límite de 200 filas por lote. Por encima, se rechaza con el conteo.
- Vista previa obligatoria antes de crear: tabla con las filas válidas y las inválidas con motivo (`documento duplicado en el archivo`, `documento vacío`, `placa inválida`, `ya tiene una autorización activa para ese destino`).
- **Éxito parcial**: se crean las filas válidas y se informa cuántas se crearon y cuántas se rechazaron. Se descarta el todo-o-nada porque en un evento real conviene que entren 48 de 50 y reintentar las 2.
- Cada pase creado lleva `batch_id` (uuid del lote) y `batch_label` (`Cumpleaños de Ana`, opcional, máximo 80 caracteres). El historial muestra el lote como etiqueta y permite filtrar por él.

### 8. Los duplicados dentro del lote se detectan en memoria

El índice único de `access_passes` no cubre "mismo documento, mismo destino, misma ventana", y agregarlo rompería autorizaciones legítimas repetidas en el tiempo. La duplicación se valida en el archivo antes de insertar, y la inserción corre en una transacción por lote para que un error de base no deje la mitad creada sin reporte.

### 9. El admin administra lugares desde el detalle de la comunidad

No se agrega un menú "Lugares". El detalle expandido de Comunidades gana un bloque "Lugares autorizables" con la lista, un botón `Agregar lugar` y acciones `Editar {nombre}` / `Archivar {nombre}` / `Restaurar {nombre}` / `Eliminar {nombre}`.

Permisos: `org_admin` y `community_admin` de esa comunidad. El platform admin puede leer y editar por su bypass existente, pero la UI de plataforma no gana un tab nuevo.

### 10. El feature flag se respeta en la UI

`config.features.dynamicQrEnabled` ya bloquea `/api/passes` con 404. Si está apagado, `/resident` muestra "Las autorizaciones no están habilitadas en esta comunidad" en vez de un error de carga. No se agrega un flag nuevo.

### 11. Los datos del historial se leen de una sola llamada

`GET /api/passes` ya devuelve la lista con alcance por membresía. Se extiende para incluir `destination: { id, name, kind } | null`, `locationPath`, `batchId` y `batchLabel`, y para aceptar `search`, `status`, `destinationId` y `batchId`. El historial no hace N llamadas por fila.

## Risks

- **Migración con columnas nulables**: `structure_id` y `location_unit_id` dejan de ser `NOT NULL`. Hay que verificar que `buildLocationPath`, el escaneo y la bitácora toleren `null` antes de aplicar la migración; hoy asumen una unidad.
- **Alcance por `location_residents`**: si la base demo tiene residentes sin fila en esa tabla, el fallback a `memberships.locationUnitId` evita romper el flujo, pero deja dos fuentes de verdad. Se documenta y se prioriza `location_residents`.
- **Carga masiva y rate limit**: 200 pases son 200 inserciones en una transacción, no 200 requests. Se mantiene un solo POST.
- **Duplicados entre lotes**: dos lotes simultáneos con el mismo documento y destino pueden crear dos pases activos. Se acepta en esta fase; el guardia ve ambos y el residente puede revocar.
- **Reutilización del QR público**: el pase de un lugar común usa el mismo token rotativo y el mismo binding de dispositivo. El guardia no necesita saber si el destino es vivienda o piscina, pero la bitácora sí debe guardar el destino para que el reporte tenga sentido.
