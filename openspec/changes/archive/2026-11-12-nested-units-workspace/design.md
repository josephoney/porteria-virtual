# Design: workspace anidado de unidades

## Context

El dashboard admin es un único componente, `AdminPanel.tsx` (~1350 líneas), que deriva la sección del `pathname` y renderiza tablas planas. La estructura de una comunidad vive en `location_structures` (1 a 3 niveles con nombres configurables) y sus nodos en `location_units` (árbol con `parentId` y `levelPosition`).

Hoy:

- `/api/sections` devuelve solo los nodos de nivel 1.
- `/api/units` devuelve solo las hojas.
- `StructureTreeDialog` carga el árbol completo, pero lo dibuja como tarjetas y panel lateral.
- `load()` corre una vez al montar y hace `Promise.all` de cinco requests: si uno falla, no se setea nada.

## Goals

- Una sola vista para consultar y editar el árbol.
- Que crear o editar se refleje sin recargar el navegador.
- Que el diálogo de estructura sea una vista de lectura que escala a cientos de nodos.
- Que el tema no tenga superficies crema.
- Mantener intactos los contratos de API.

## Non-goals

- Cambiar el modelo de datos o los endpoints.
- Drag & drop para reordenar.
- Reemplazar la administración de usuarios, invitaciones o llamadas.

## Decisions

### 1. Un componente de tabla, dos modos

`LocationTreeTable` recibe la estructura, la lista plana de nodos y un `mode`.

```ts
type LocationTreeTableProps = {
  structure: {
    levelCount: 1 | 2 | 3;
    level1Name: string;
    level2Name: string | null;
    level3Name: string | null;
  };
  nodes: LocationNode[];
  mode: 'manage' | 'readonly';
  onAddChild?: (parent: LocationNode | null) => void;
  onEdit?: (node: LocationNode) => void;
  onArchive?: (node: LocationNode) => void;
  onDelete?: (node: LocationNode) => void;
  onResidents?: (node: LocationNode) => void;
};
```

En `manage` muestra la fila de alta y las acciones. En `readonly` solo dibuja la jerarquía, sin botones de mutación. Así el diálogo de estructura no duplica lógica de árbol y Unidades no duplica el render.

### 2. Expansión múltiple con un Set

`useExpandedRow` guarda un solo id, suficiente para el detalle de una fila. El árbol necesita varias ramas abiertas. Nuevo hook `useExpandedTree` con `Set<string>` y `toggle(id)`, `isExpanded(id)`, `expand(id)`, `collapse(id)`.

El estado vive en el componente de tabla, no en el padre: al cambiar de comunidad se remonta con `key={communityId}` y el árbol arranca colapsado.

### 3. La fila se expande desde un botón, no desde el `<tr>`

Las tablas expandibles actuales ponen `role="button"` en el `<tr>`, lo que elimina el rol `row` del árbol de accesibilidad. En la tabla nueva el toggle es un `<button>` dentro de la primera celda, con `aria-expanded` y `aria-controls`. La fila conserva `role="row"`.

### 4. Nivel 1 siempre visible, hijos indentados

Se renderiza una fila por nodo visible. `depth` decide el padding izquierdo y el tamaño del texto. Solo se muestran los hijos cuyo padre está expandido. La fila de alta aparece al final de cada grupo con hijos visibles y al final de la tabla para el nivel 1.

Con `levelCount === 1` los nodos de nivel 1 son hojas: no hay chevron, las acciones incluyen residentes y no hay fila de alta de hijos.

### 5. Datos: una sola lectura del árbol

`UnitsWorkspace` pide en paralelo `/api/location-structures?communityId=` y `/api/location-units?communityId=`. La lista plana se indexa con `childrenByParent` y se ordena por `name`. No se usan `/api/sections` ni `/api/units` en esta vista.

### 6. Alta y mutaciones

- Crear nodo: `POST /api/location-units` con `structureId` (raíz) o `parentId`.
- Editar: `PATCH /api/location-units/:id` con nombre, código y tipo de sección.
- Archivar/restaurar: `POST /api/location-units/:id/archive|restore` (afecta al subárbol).
- Eliminar: `DELETE /api/location-units/:id`, solo si no tiene hijos. La UI deshabilita el botón y explica por qué.
- Después de cada mutación se recarga el árbol de esa comunidad. No hay actualización optimista de nodos: el árbol es barato de releer y evita divergencias.

### 7. Freshness sin recargar

`AdminPanel` mantiene `refreshKey`. `load()` pasa a depender de la sección activa y de `refreshKey`, y usa `Promise.allSettled` para que un endpoint caído no borre el resto.

- Crear/editar comunidad: inserta la respuesta del POST/PATCH en el estado y luego reconcilia con `load()`.
- Cerrar el diálogo de estructura: `onClosed` incrementa `refreshKey` y descarta el overview cacheado de esa comunidad.
- Guardar una comunidad: descarta su overview y, si la fila está abierta, lo vuelve a pedir.

### 8. Superficies neutras

`--popover` en claro pasa de `oklch(0.9856 0.0278 98.054)` (crema) a un gris casi blanco alineado con `--background`. Como `DialogContent`, `Select`, `DropdownMenu` y `Popover` consumen ese token, el cambio es de una línea y coherente en toda la app. En oscuro no se toca: `oklch(0.2703 0.0407 281.3036)` ya es neutro.

El bloque de resumen del diálogo de estructura deja `bg-muted/40` y usa `bg-card`, el mismo valor que `--sidebar`.

### 9. Residentes fuera del diálogo

El panel de residentes se extrae a `ResidentAssignmentPanel`, con la misma lógica de endpoints por rol (`/api/users` para tenant, `/api/platform/users` para plataforma). Se abre desde el icono de residentes de una hoja en Unidades. El diálogo de estructura deja de mezclar estructura con ocupación.

### 10. Rutas y navegación

`/admin/sections` y `/platform/sections` redirigen a `/units`. El sidebar pierde el ítem "Secciones". El header mapea `units` a "Unidades". No se borran los endpoints ni los tipos de sección.

## Risks

- `StructureTreeDialog` y `AdminPanel` son archivos grandes; el refactor se hace en commits separados para que cada uno sea revisable.
- El panel de residentes tiene dos ramas de API según rol; al extraerlo se conservan ambas.
- Archivar un subárbol es una acción de alcance amplio: se confirma indicando cuántos nodos se verán afectados.
- Cambiar `--popover` afecta a todos los flotantes. Es deseado, pero hay que revisar selects y dropdowns en claro y oscuro.
- `LocationTreeTable` con cientos de nodos puede renderizar de más si se expanden todas las ramas; el estado arranca colapsado y no hay "expandir todo".
