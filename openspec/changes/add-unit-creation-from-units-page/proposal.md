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
- Al guardar, el listado se refresca sin recargar la página y la unidad nueva queda
  visible con su ruta.

**Non-goals:**

- Editar o eliminar unidades desde esta página.
- Crear secciones o niveles intermedios desde aquí: eso sigue en Estructura → Árbol.
- Cambiar el formulario del árbol.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `units-workspace`: se agrega el alta de unidades desde el listado.

## Impact

- **Dashboard**: `UnitsPage.tsx` (acción y refresco) y un `CreateUnitDialog.tsx` nuevo.
- **API**: sin cambios; se reutiliza `POST /api/location-units`.
- **Base de datos**: sin migración.
- **Pruebas**: E2E del alta desde Unidades.
