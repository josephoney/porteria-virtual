## Why

La página de Unidades es de solo lectura. Para dar de alta una unidad hay que salir a
**Estructura → Árbol**, expandir la sección y crear la hoja ahí. Es la tarea más frecuente
del administrador y obliga a cambiar de pantalla justo cuando está mirando el listado de
unidades y detecta que falta una.

## What Changes

- Acción **Nueva unidad** en la cabecera de la página de Unidades (`/admin/units` y
  `/platform/units`), visible solo para roles con permiso de estructura.
- Diálogo con comunidad, sección y, si la estructura tiene más niveles, los niveles
  intermedios necesarios; más nombre y código.
- La unidad se crea en el **nivel hoja** de la estructura de esa comunidad, reutilizando
  `POST /api/location-units` (el mismo endpoint del árbol). Sin endpoints nuevos.
- **Editar** una unidad desde la fila (nombre y código), con `PATCH /api/location-units/:id`.
- **Eliminar** una unidad desde la fila con **doble confirmación** y
  `DELETE /api/location-units/:id`.
- **Unicidad entre hermanos**: no se puede repetir el nombre ni el código de otra unidad o
  sección del mismo nivel (hoy la base solo protege el código y permite nulos).
- Al guardar, el listado se refresca sin recargar la página y la unidad nueva queda
  visible con su ruta.

**Non-goals:**

- Mover una unidad a otra sección desde esta página.
- Crear, editar o eliminar secciones y niveles intermedios desde aquí: siguen en
  Estructura → Árbol.
- Cambiar el formulario del árbol.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `units-workspace`: se agrega el alta, la edición y el borrado de unidades desde el
  listado, más la unicidad de nombre y código entre hermanos.

## Impact

- **Dashboard**: `UnitsPage.tsx`, `CreateUnitDialog.tsx`, `EditUnitDialog.tsx` y
  `DeleteUnitDialog.tsx`.
- **API**: `location-nodes.routes.ts` agrega la comprobación de unicidad entre hermanos en
  el alta y en la edición.
- **Base de datos**: sin migración; la comprobación es de aplicación.
- **Pruebas**: E2E del alta, el duplicado, la edición y el borrado.
