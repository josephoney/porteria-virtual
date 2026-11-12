## Why

Hoy una comunidad puede tener varias filas en `location_structures`. En la práctica eso produce pantallas confusas como la de Torre Norte, con "Estructura principal" y "Estructura 2", dos botones de edición y unidades repartidas entre estructuras que deberían ser una sola definición.

El producto necesita una única estructura por comunidad, con hasta tres niveles y nombres configurables. Las torres, pisos y unidades siguen siendo nodos del árbol; la estructura solo define cuántos niveles hay y cómo se llama cada uno.

## What Changes

- Agregar una restricción única sobre `location_structures.community_id`.
- Migrar las comunidades que hoy tienen más de una estructura a una estructura primaria, moviendo sus `location_units` y actualizando las referencias de pases y escaneos.
- Rechazar con `409 structure_already_exists` la creación de una segunda estructura.
- Reemplazar el formulario de "Nueva estructura" por una edición de la estructura única: cantidad de niveles (1–3) y nombres de cada nivel.
- Impedir reducir la cantidad de niveles si existen unidades en los niveles que se eliminarían (`409 structure_has_units_at_removed_level`).
- Mostrar en el diálogo "Ver estructura" un solo encabezado, un solo botón de edición y un solo botón para crear el primer nodo del nivel 1.

## Capabilities

### New

- `location-structure-singleton`: una estructura por comunidad, definición de niveles y migración segura.

### Modified

- `database-schema`: índice único y consolidación de estructuras.
- `access-bitacora` / `pass-scan-entry`: sin cambios funcionales; solo se preservan las referencias existentes a `structure_id`.

## Impact

- `packages/database/src/schema/location-structures.ts` y una migración nueva.
- `server/api/src/routes/structures.routes.ts`.
- `apps/dashboard/src/components/layout/StructureTreeDialog.tsx` y `StructureForm.tsx`.
- `apps/dashboard/src/components/admin/AdminPanel.tsx` (acción "Ver estructura").
- Tests de integración y Playwright.

## Fuera de alcance

- Más de tres niveles.
- Varias estructuras por comunidad.
- Cambiar la semántica del árbol de unidades.
- Renombrar automáticamente códigos o nombres en conflicto durante la migración.
- Edición masiva de unidades.
