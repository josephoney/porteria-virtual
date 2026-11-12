## Why

El admin trabaja con dos modelos mentales distintos para el mismo dato. "Secciones" y "Unidades" son dos tablas planas que representan un árbol, y la estructura se edita en un tercer lugar —un diálogo de tarjetas— que no se comunica con ninguna de las dos. El resultado son siete síntomas que el usuario reportó en la misma sesión:

1. Una comunidad recién creada no aparece en la tabla sin refrescar el navegador.
2. Los diálogos tienen un fondo crema que no pertenece al tema.
3. La columna Acciones usa botones de texto donde debería haber iconos.
4. La estructura solo se puede agregar desde un diálogo lateral, no desde la tabla donde se consulta.
5. Los cambios de estructura no se reflejan hasta recargar.
6. "Ver estructura" tiene un layout de tarjetas que no escala.
7. No existe una vista jerárquica: para saber qué pisos tiene una torre hay que cruzar dos tablas.

La causa común es que **el árbol se consulta en un lugar y se edita en otro**, y ninguna vista invalida a la otra.

## What Changes

- **Un solo menú "Unidades"**: "Secciones" desaparece del sidebar y `/admin/sections` redirige a `/admin/units`. Los endpoints existentes se mantienen.
- **Tabla anidada por niveles**: se muestran los nodos del nivel 1; al hacer click se expande el siguiente nivel, y así hasta las hojas. Multi-expand, no una sola rama.
- **Alta al final de cada grupo**: una fila `+ Agregar {nombre del nivel}` con el nombre real de la estructura ("Torre", "Piso", "Casa").
- **Acciones por nivel**: editar, archivar/restaurar y eliminar (solo sin hijos); residentes en las hojas.
- **Selector de comunidad** persistido, porque el árbol es de una comunidad a la vez.
- **Comunidades con acciones icónicas**: editar, estructura e invitar admin, con `aria-label`.
- **Alta de comunidad sin recarga**: la fila se inserta con la respuesta del POST y se reconcilia en segundo plano.
- **Diálogo de estructura como tabla colapsable de solo lectura**, con "Editar estructura" para la definición de niveles.
- **Invalidación cruzada**: cerrar el diálogo de estructura refresca la tabla de origen y el árbol; guardar una comunidad invalida su detalle.
- **Superficies neutras**: `--popover` deja de ser crema y pasa a un neutro alineado con el fondo.

## Capabilities

### New Capabilities

- `units-workspace`: menú único, selector de comunidad, tabla anidada, alta y acciones por nivel.
- `communities-workspace`: tabla de comunidades, acciones icónicas, alta optimista y detalle expandido.
- `structure-workspace`: diálogo de estructura como tabla colapsable de solo lectura y definición de niveles.
- `dashboard-surfaces`: superficies de diálogo, popover y dropdown con tokens neutros en claro y oscuro.
- `dashboard-data-freshness`: las mutaciones invalidan las vistas dependientes sin recargar el navegador.

### Modified Capabilities

- Ninguna. Los endpoints y el modelo de datos no cambian; los cambios pendientes de `single-location-structure` y `polish-admin-workspace` siguen siendo la fuente del modelo.

## Impact

- `apps/dashboard/src/components/admin/AdminPanel.tsx`
- `apps/dashboard/src/components/admin/UnitsWorkspace.tsx` (nuevo)
- `apps/dashboard/src/components/admin/LocationTreeTable.tsx` (nuevo)
- `apps/dashboard/src/components/admin/ResidentAssignmentPanel.tsx` (nuevo, extraído)
- `apps/dashboard/src/components/layout/StructureTreeDialog.tsx`
- `apps/dashboard/src/components/layout/AppSidebar.tsx`
- `apps/dashboard/src/components/layout/SiteHeader.tsx`
- `apps/dashboard/src/lib/use-expanded-tree.ts` (nuevo)
- `apps/dashboard/src/App.tsx`
- `apps/dashboard/src/styles/theme.css`
- `tests/nested-units.spec.ts` (nuevo)

## Fuera de alcance

- Cambios de esquema, migraciones o endpoints nuevos. `/api/sections` y `/api/units` se conservan por compatibilidad con kiosco y residente.
- Reordenar nodos con drag & drop o cambiar el orden de los niveles.
- Unificar la vista de plataforma con permisos distintos a los del tenant; usa el mismo componente en modo lectura o gestión según el rol.
- Búsqueda global dentro del árbol; el filtro es por comunidad.
- internacionalización de los nombres de nivel; los define cada estructura.
