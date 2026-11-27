## 1. DiÃƒÂ¡logo de creaciÃƒÂ³n

- [x] 1.1 Crear `apps/dashboard/src/components/admin/CreateUnitDialog.tsx` con selects de comunidad, secciÃƒÂ³n y niveles intermedios, mÃƒÂ¡s nombre y cÃƒÂ³digo.
- [x] 1.2 Cargar la estructura de la comunidad (`GET /api/location-structures?communityId=`) y los nodos (`GET /api/location-units?communityId=`).
- [x] 1.3 Construir la cadena de padres segÃƒÂºn `levelCount` y nombres de nivel.
- [x] 1.4 Soportar estructura de un nivel enviando `structureId` como raÃƒÂ­z.
- [x] 1.5 Validar nombre requerido y deshabilitar el guardado sin estructura o sin padres disponibles.
- [x] 1.6 Enviar `POST /api/location-units` y mostrar el error del servidor sin cerrar el diÃƒÂ¡logo.

## 2. PÃƒÂ¡gina de Unidades

- [x] 2.1 Agregar la acciÃƒÂ³n "Nueva unidad" en la cabecera, solo para `org_admin` y `community_admin`.
- [x] 2.2 Abrir el diÃƒÂ¡logo con la comunidad del filtro cuando estÃƒÂ© seleccionada.
- [x] 2.3 Invalidar la cachÃƒÂ© `['units']` al crear y refrescar el listado sin recargar.

## 3. Pruebas y cierre

- [x] 3.1 E2E: crear una unidad desde Unidades y verla en el listado.
- [x] 3.2 `eslint` del dashboard y `tsc` sin errores nuevos en los archivos tocados.
- [x] 3.3 `openspec validate add-unit-creation-from-units-page --strict`.

## 4. EdiciÃ³n, borrado y unicidad

- [x] 4.1 Agregar la comprobaciÃ³n de unicidad entre hermanos (nombre y cÃ³digo) en el alta y en la ediciÃ³n de `location-nodes.routes.ts`, devolviendo `409` con `duplicate_name` / `duplicate_code`.
- [x] 4.2 Crear `EditUnitDialog` con nombre y cÃ³digo, mapeando el error de duplicado sin cerrar.
- [x] 4.3 Crear `DeleteUnitDialog` con dos pasos y mensajes para residentes, hijos y autorizaciones.
- [x] 4.4 Agregar a la fila de unidades las acciones editar (lÃ¡piz) y eliminar (papelera), junto a la de invitar.
- [x] 4.5 Ajustar la cabecera y el `colSpan` de la tabla a las acciones disponibles.
- [x] 4.6 Invalidar la cachÃ© de unidades al editar y al eliminar.

## 5. Pruebas de la ampliaciÃ³n

- [x] 5.1 E2E: crear, intentar duplicar (409 visible), editar y eliminar con doble confirmaciÃ³n.
- [x] 5.2 `tsc` del API, `eslint` de los archivos tocados y `openspec validate --strict`.
