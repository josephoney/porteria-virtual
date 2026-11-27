## 1. DiÃ¡logo de creaciÃ³n

- [x] 1.1 Crear `apps/dashboard/src/components/admin/CreateUnitDialog.tsx` con selects de comunidad, secciÃ³n y niveles intermedios, mÃ¡s nombre y cÃ³digo.
- [x] 1.2 Cargar la estructura de la comunidad (`GET /api/location-structures?communityId=`) y los nodos (`GET /api/location-units?communityId=`).
- [x] 1.3 Construir la cadena de padres segÃºn `levelCount` y nombres de nivel.
- [x] 1.4 Soportar estructura de un nivel enviando `structureId` como raÃ­z.
- [x] 1.5 Validar nombre requerido y deshabilitar el guardado sin estructura o sin padres disponibles.
- [x] 1.6 Enviar `POST /api/location-units` y mostrar el error del servidor sin cerrar el diÃ¡logo.

## 2. PÃ¡gina de Unidades

- [x] 2.1 Agregar la acciÃ³n "Nueva unidad" en la cabecera, solo para `org_admin` y `community_admin`.
- [x] 2.2 Abrir el diÃ¡logo con la comunidad del filtro cuando estÃ© seleccionada.
- [x] 2.3 Invalidar la cachÃ© `['units']` al crear y refrescar el listado sin recargar.

## 3. Pruebas y cierre

- [x] 3.1 E2E: crear una unidad desde Unidades y verla en el listado.
- [x] 3.2 `eslint` del dashboard y `tsc` sin errores nuevos en los archivos tocados.
- [x] 3.3 `openspec validate add-unit-creation-from-units-page --strict`.
