# Design: workspace de autorizaciones del residente

## Context

El dashboard (`apps/dashboard`) resuelve el post-login en `HomePage`: los roles `owner`, `tenant` y `resident` van a `/app-required`, una pantalla que explica que la app de residentes es Zima QR Access. `apps/resident` es un stub de 14 líneas, así que hoy el residente **no tiene** superficie web.

La API ya soporta casi todo lo necesario:

- `POST /api/passes` con `requireRole('owner', 'tenant', 'resident')`.
- `GET /api/passes` con filtros y alcance por membresía.
- `GET /api/passes/:id/qr` para el QR rotativo del residente autenticado.
- `POST /api/passes/:id/revoke` y `/:id/regenerate-link`.

Lo que falta es de modelo y de superficie:

- `pass.service` exige que el destino sea una hoja y que coincida con `memberships.locationUnitId`. No hay destino que no sea la vivienda.
- No hay forma de distinguir un lugar común de una vivienda dentro del árbol.
- No existe alta por lote.
- No existe UI.

## Goals

- Que un residente entre al dashboard y gestione sus autorizaciones sin salir a otra app.
- Que pueda autorizar a su vivienda **o** a un lugar común de su comunidad.
- Que la comunidad defina sus lugares comunes con las mismas herramientas que ya usa para torres y pisos.
- Que pueda autorizar a muchas personas de una vez con un CSV y ver qué filas fallaron y por qué.
- Que el historial sea la vista principal: qué autorizó, a dónde, hasta cuándo y en qué estado.
- Reusar el QR rotativo, el enlace público y el binding de dispositivo ya especificados en `add-dynamic-qr-access`, sin duplicarlos.

## Non-goals

- Notificar al visitante por canales externos.
- Reservar amenidades, cobrar o controlar cupos.
- Cambiar el flujo del guardia ni el escaneo.
- Construir la app móvil del residente.
- Crear un catálogo de lugares paralelo al árbol de ubicaciones.

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

### 3. Los lugares comunes son ramas del árbol, no una entidad nueva

Un lugar común es una **rama** de `location_units`, no una tabla aparte. La sección de nivel 1 marca la rama con `section_type = 'common_area'`; sus descendientes son los lugares concretos.

El admin ya crea secciones de nivel 1 en `Unidades`. Lo único que falta es que ese alta pida el tipo. Un ejemplo real:

```
Zonas comunes        (nivel 1, section_type = 'common_area')
├── Piscina          (nivel 2)
├── Club social      (nivel 2)
└── Cancha de golf   (nivel 2)
```

No hay nivel 3 para esos espacios, y no hace falta: el destino puede ser un nodo interno.

Consecuencias:

- Una sola jerarquía para viviendas y lugares comunes. El guardia, la bitácora y `buildLocationPath` siguen funcionando sin ramas nuevas.
- El nombre del nivel 1 sigue siendo libre: la rama puede llamarse "Zonas comunes", "Amenidades" o "Áreas sociales"; lo que la identifica es el tipo, no el texto.
- Los lugares se renombran, archivan y eliminan con las acciones que la tabla anidada ya tiene.

Se descarta la tabla `community_destinations` del primer borrador: obligaba a mantener dos catálogos y a resolver dos caminos en cada lectura de pases.

### 4. El pase sigue apuntando a un nodo, y el nodo es el destino

`access_passes.location_unit_id` y `structure_id` **siguen `NOT NULL`**. No hay columna `destination_id`, ni columnas nulables, ni check de exclusividad.

La diferencia entre vivienda y lugar común es una propiedad del nodo, no del pase. El pase guarda el nodo; la lectura deriva `kind` subiendo hasta el nivel 1:

```ts
function destinationKind(level1SectionType: string | null) {
  return level1SectionType === 'common_area' ? 'common_area' : 'home';
}
```

Es un `LEFT JOIN` de a un padre por nivel, con un máximo de tres niveles. El costo es despreciable y la integridad referencial queda garantizada por la FK existente.

### 5. La validación de hoja se relaja solo para lugares comunes

Hoy `pass.service` rechaza cualquier destino que no sea hoja. La regla nueva:

- **Vivienda**: el nodo debe ser hoja y no pertenecer a una rama `common_area`.
- **Lugar común**: el nodo puede ser interno. Solo se exige que esté activo y que su nivel 1 sea `common_area`.

Sin esta excepción, `Piscina` en una estructura de tres niveles sería rechazada por no tener hijos.

### 6. El residente autoriza su vivienda o cualquier lugar común activo

Alcance del destino:

- **Vivienda**: unidades hoja donde el usuario tenga un `location_residents` activo. Si no tiene ninguna fila ahí, se acepta `memberships.locationUnitId` como fallback, que es lo que hoy usa `pass.service`.
- **Lugar común**: cualquier nodo activo dentro de una rama `common_area` de la comunidad de la membresía activa.
- Un residente **no** puede autorizar la vivienda de otro. La validación se hace en el servicio, no solo en el formulario.

El selector muestra primero "Mi vivienda" con la ruta (`Torre Norte › Torre 1 › Piso 3 › Apartamento 302`) y debajo "Zonas comunes" con la ruta de cada lugar.

### 7. El tipo de sección se elige al crear el nivel 1

El alta de nivel 1 en `Unidades` hoy envía `sectionType: 'other'` con la etiqueta del nivel. Pasa a mostrar un select con los tipos de `sectionTypeEnum` más `Zona común`.

Valor por defecto: el tipo que corresponda al nombre del nivel cuando exista (`Torre` → `tower`, `Piso` → `floor`, `Casa` → `house`, `Bloque` → `block`, `Lote` → `lot`), y `other` cuando no.

`common_area` se agrega al enum con una migración de una línea. Se descarta reutilizar `zone`, que ya significa otra cosa (zonas de una urbanización) y volvería ambiguo el filtro.

### 8. Historial primero, con acciones por fila

`/resident/authorizations` es la vista principal y la que abre el menú. Columnas: Visitante, Destino, Vigencia, Estado, Acciones.

- Búsqueda por nombre o documento.
- Filtros: estado (`active`, `used`, `revoked`, `expired`) y destino.
- Orden por `valid_from` descendente.
- Acciones icónicas con `aria-label`: `Ver QR de {visitante}`, `Copiar enlace de {visitante}`, `Regenerar enlace de {visitante}`, `Revocar autorización de {visitante}`.
- Revocar pide confirmación y explica que el QR deja de servir.
- El QR se muestra en un diálogo que refresca el token antes de los 24 s, igual que el resto del sistema.

### 9. Carga masiva: CSV pegado o subido, un destino y una ventana

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

`batch_id` y `batch_label` son las únicas columnas nuevas en `access_passes`.

### 10. Los duplicados dentro del lote se detectan en memoria

El índice único de `access_passes` no cubre "mismo documento, mismo destino, misma ventana", y agregarlo rompería autorizaciones legítimas repetidas en el tiempo. La duplicación se valida en el archivo antes de insertar, y la inserción corre en una transacción por lote para que un error de base no deje la mitad creada sin reporte.

### 11. No hay menú ni bloque nuevo para lugares comunes

El admin los gestiona desde `Unidades`, que ya es la pantalla del árbol. Un bloque en el detalle de la comunidad duplicaría la misma operación con otra UX y otra caché. El detalle de la comunidad solo muestra el resumen de estructura, que ya incluye la rama.

### 12. El feature flag se respeta en la UI

`config.features.dynamicQrEnabled` ya bloquea `/api/passes` con 404. Si está apagado, `/resident` muestra "Las autorizaciones no están habilitadas en esta comunidad" en vez de un error de carga. No se agrega un flag nuevo.

### 13. Los datos del historial se leen de una sola llamada

`GET /api/passes` ya devuelve la lista con alcance por membresía. Se extiende para incluir `destination: { id, name, path, kind }`, `batchId` y `batchLabel`, y para aceptar `search`, `status`, `destinationUnitId` y `batchId`. El historial no hace N llamadas por fila.

## Risks

- **Validación de hoja relajada**: es el cambio con más superficie. `pass.service` hoy asume hoja en varios puntos; hay que centralizar la regla y cubrirla con tests de ambos tipos de destino.
- **Clasificación por ancestro**: si una rama común se mueve bajo una torre, el nodo cambia de tipo. El movimiento de nodos ya existe; el design acepta el cambio de clasificación y no lo bloquea.
- **Borrado de una rama en uso**: la FK de `access_passes` restringe el borrado, pero la API debe traducirlo a 409 con mensaje claro en vez de un 500.
- **Alcance por `location_residents`**: si la base demo tiene residentes sin fila en esa tabla, el fallback a `memberships.locationUnitId` evita romper el flujo, pero deja dos fuentes de verdad. Se documenta y se prioriza `location_residents`.
- **Carga masiva y rate limit**: 200 pases son 200 inserciones en una transacción, no 200 requests. Se mantiene un solo POST.
- **Duplicados entre lotes**: dos lotes simultáneos con el mismo documento y destino pueden crear dos pases activos. Se acepta en esta fase; el guardia ve ambos y el residente puede revocar.
- **Reutilización del QR público**: un pase a un lugar común usa el mismo token rotativo y el mismo binding de dispositivo. El guardia no necesita saber si el destino es vivienda o piscina, pero la bitácora sí debe guardar el destino para que el reporte tenga sentido.
