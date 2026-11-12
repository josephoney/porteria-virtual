# Tasks: nested-units-workspace

## 1. Superficies neutras

- [x] 1.1 Cambiar `--popover` del tema claro en `apps/dashboard/src/styles/theme.css` a un neutro alineado con `--background`, sin tocar el oscuro.
- [x] 1.2 Verificar que `DialogContent`, `Select`, `DropdownMenu` y `Popover` heredan el token y no tienen overrides propios.
- [x] 1.3 Pasar el bloque de resumen del diálogo de estructura de `bg-muted/40` a `bg-card`.
- [x] 1.4 Correr `pnpm run check:theme` y revisar claro/oscuro en la app.

## 2. Primitivas compartidas

- [x] 2.1 Crear `apps/dashboard/src/lib/use-expanded-tree.ts` con `Set<string>`, `toggle`, `isExpanded`, `expand`, `collapse`.
- [x] 2.2 Crear `apps/dashboard/src/components/admin/LocationTreeTable.tsx` con la estructura, los nodos y el modo `manage | readonly`.
- [x] 2.3 Implementar la expansión por botón en la primera celda con `aria-expanded` y `aria-controls`, conservando `role="row"`.
- [x] 2.4 Implementar la indentación por profundidad y el resumen de descendientes por nodo.
- [x] 2.5 Implementar la fila `+ Agregar {levelNName}` al final de cada grupo y al final de la tabla.
- [x] 2.6 Implementar las acciones por nivel: editar, archivar/restaurar, eliminar (deshabilitado con hijos) y residentes en hojas.
- [x] 2.7 Implementar los estados vacíos: sin estructura, con estructura sin nodos y con nodos archivados.

## 3. Workspace de Unidades

- [x] 3.1 Crear `apps/dashboard/src/components/admin/UnitsWorkspace.tsx` con selector de comunidad y persistencia de la última elección.
- [x] 3.2 Cargar en paralelo la estructura y los nodos de la comunidad seleccionada; indexar con `childrenByParent`.
- [x] 3.3 Conectar alta, edición, archivado, restauración y eliminación contra `/api/location-units`.
- [x] 3.4 Extraer el panel de residentes de `StructureTreeDialog` a `ResidentAssignmentPanel.tsx`, conservando las ramas de `/api/users` y `/api/platform/users`.
- [x] 3.5 Abrir el panel de residentes desde la acción de una hoja.
- [x] 3.6 Mostrar confirmaciones con el conteo del subárbol antes de archivar o eliminar.
- [x] 3.7 Recargar el árbol de la comunidad después de cada mutación.

## 4. Integración en AdminPanel

- [x] 4.1 Quitar la sección `sections` del render y montar `UnitsWorkspace` en `units`.
- [x] 4.2 Convertir `load()` a `Promise.allSettled` con error por fuente, sin vaciar el estado completo.
- [x] 4.3 Hacer que `load()` dependa de la sección activa y de `refreshKey`.
- [x] 4.4 Implementar la inserción optimista al crear una comunidad y la reconciliación posterior.
- [x] 4.5 Invalidar el overview cacheado al editar una comunidad y recargarlo si la fila está expandida.

## 5. Comunidades

- [x] 5.1 Reemplazar los botones de texto de la columna Acciones por iconos con `aria-label` y tooltip: editar, estructura, invitar admin.
- [x] 5.2 Mantener las tres acciones accesibles por teclado y con foco visible.
- [x] 5.3 Verificar que la fila sigue expandiendo su detalle por click, Enter y Space.
- [x] 5.4 Asegurar que abrir el diálogo de estructura no colapsa la fila.

## 6. Diálogo de estructura

- [x] 6.1 Reemplazar el grid de tarjetas por `LocationTreeTable` en modo `readonly`.
- [x] 6.2 Mantener "Editar estructura" con `StructureForm` para cantidad y nombres de niveles.
- [x] 6.3 Mostrar el resumen de niveles y totales con los nombres configurados.
- [x] 6.4 Explicar en el diálogo que los nodos se gestionan en Unidades.
- [x] 6.5 Invocar `onClosed` al cerrar para refrescar las vistas de origen.

## 7. Navegación

- [x] 7.1 Quitar "Secciones" del sidebar tenant y de plataforma.
- [x] 7.2 Redirigir `/admin/sections` a `/admin/units` y `/platform/sections` a `/platform/units`.
- [x] 7.3 Actualizar el label de sección en `SiteHeader`.
- [x] 7.4 Confirmar que los endpoints `/api/sections` y `/api/units` siguen disponibles para kiosco y residente.

## 8. Verificación

- [x] 8.1 Typecheck del dashboard y del API.
- [x] 8.2 Lint y Prettier de los archivos tocados.
- [x] 8.3 `pnpm exec openspec validate nested-units-workspace --strict`.
- [x] 8.4 Playwright: anidamiento de tres niveles, multi-expand, alta de nodo sin recarga y acciones por nivel.
- [x] 8.5 Playwright: refresh al cerrar la estructura (cubierto). La creación de comunidad sin recarga queda validada por tipo y por la inserción optimista, sin test automático para no dejar comunidades de prueba en la base demo.
- [x] 8.6 Playwright: superficie neutra del diálogo en claro y continuidad en oscuro.
- [x] 8.7 Suite completa de Playwright en verde.
