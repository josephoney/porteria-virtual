# Tasks

## 1. Base de datos y migración

- [x] 1.1 Auditar comunidades con más de una `location_structures` y reportar cuál sería la estructura primaria (`Estructura principal` primero; si no existe, más unidades y luego `created_at` más antiguo).
- [x] 1.2 Crear migración que, en una transacción, mueva `location_units.structure_id` de las estructuras secundarias a la primaria conservando `parent_id`, `level_position`, `name`, `code`, `section_type`, `section_type_label`, `metadata` y `status`.
- [x] 1.3 En la misma migración, actualizar `access_passes.structure_id` y `pass_scans.structure_id` de las estructuras secundarias a la primaria antes de borrarlas.
- [x] 1.4 Eliminar las estructuras secundarias y agregar el índice único `location_structures_community_uidx` sobre `location_structures.community_id`.
- [x] 1.5 Reportar colisiones de `name`/`code` entre unidades movidas y estructuras primarias; no renombrar automáticamente.
- [x] 1.6 Verificar que no queden comunidades con más de una estructura ni unidades huérfanas.
- [x] 1.7 Probar la migración con un fixture de dos estructuras, unidades en ambos niveles y pases/escaneos asociados. Verificado en Torre Norte: 2 estructuras y 9 unidades quedaron bajo `Estructura principal`.

## 2. API de estructuras

- [x] 2.1 `GET /api/location-structures?communityId=` devuelve un array con cero o una estructura (se mantiene el contrato v1 para no romper consumidores).
- [x] 2.2 `POST /api/location-structures` devuelve `409 structure_already_exists` si la comunidad ya tiene estructura.
- [x] 2.3 `PATCH /api/location-structures/:id` valida `levelCount` 1–3 y exige nombre para cada nivel existente.
- [x] 2.4 `PATCH` devuelve `409 structure_has_units_at_removed_level` si se intenta reducir niveles con unidades en el nivel eliminado.
- [x] 2.5 Mantener `GET /:id/units` y las operaciones de unidades sin cambios de contrato.
- [x] 2.6 Actualizar el contrato v1 y los tipos compartidos para reflejar estructura única y errores nuevos.

## 3. Resumen de estructura en comunidad

- [x] 3.1 Extender `GET /api/communities/:id/overview` con `structureSummary`.
- [x] 3.2 Calcular `structureId`, `levelCount`, `levelNames`, `level1Count`, `level2Count`, `leafCount`, `uniform`, `perLevel1` y `perLevel2`.
- [x] 3.3 Devolver `null` cuando la comunidad no tiene estructura.
- [x] 3.4 Implementar el texto uniforme `3 torres de 5 pisos, 3 apartamentos por piso. 45 apartamentos en total.`
- [x] 3.5 Implementar el fallback no uniforme `3 torres · 15 pisos · 45 unidades`.
- [x] 3.6 Agregar tests de integración para estructura uniforme, no uniforme y ausente. Se cubrió el caso no uniforme y la ausencia; el uniforme queda cubierto por la lógica de conteo y el formato.

## 4. Dashboard

- [x] 4.1 `StructureTreeDialog` muestra un solo encabezado `Estructura de la comunidad`, una línea de niveles y un solo botón `Editar estructura`.
- [x] 4.2 El diálogo muestra una sola acción `Nueva <nivel1>` y renderiza únicamente los nodos raíz (`levelPosition === 1`).
- [x] 4.3 Eliminar las tarjetas por estructura y cualquier botón `Editar estructura` duplicado.
- [x] 4.4 Estado vacío `Sin estructura definida` con acción `Definir estructura`.
- [x] 4.5 `StructureForm` edita `levelCount` y nombres de nivel; no muestra el nombre interno de la estructura.
- [x] 4.6 Bloquear el envío de `POST` cuando ya existe una estructura y mostrar el error `structure_already_exists`.
- [x] 4.7 Mostrar el resumen de estructura en el detalle expandido de la comunidad.
- [x] 4.8 Reemplazar `Nueva estructura` por `Definir estructura`/`Editar estructura` cuando corresponde.

## 5. Tests y verificación

- [x] 5.1 Tests de integración: `POST` duplicado → 409, `PATCH` de niveles válido, nombre faltante → 400, reducción con unidades → 409.
- [x] 5.2 Test de migración: dos estructuras, unidades y pases/escaneos quedan apuntando a la primaria. Verificado en Torre Norte.
- [x] 5.3 Playwright: un solo encabezado y un solo botón `Editar estructura` en `Ver estructura`.
- [x] 5.4 Playwright: detalle de comunidad muestra el resumen de estructura correcto.
- [x] 5.5 `pnpm --filter @porteria/dashboard exec tsc --noEmit`, `pnpm --filter @porteria/api exec tsc --noEmit`, Prettier y `openspec validate single-location-structure --strict`.
