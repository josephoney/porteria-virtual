## 1. Base de datos

- [x] 1.1 Agregar `branch_level_count` (smallint, nullable) a `location_units` con su índice por rama.
- [x] 1.2 Agregar `node_type` y `node_type_label` (text, nullable) a `location_units`.
- [x] 1.3 Migración `0042_node_types.sql` con backfill de `node_type`/`node_type_label` desde `section_type` (nivel 1).
- [x] 1.4 Verificar que las columnas son aditivas y que el comportamiento de hoja no cambia con los datos existentes.
- [ ] 1.5 Extender `schema-migration.integration.test.ts` con las columnas y el backfill.
- [x] 1.6 Backfill de `branch_level_count = level_count` en la migración de la fase 2.

## 2. Regla de hoja y profundidad

- [x] 2.1 Crear un helper único `resolveLeafLevel(node, structure)` y usarlo en `validateLocationUnit`.
- [x] 2.2 Reemplazar la comparación `levelPosition === structure.levelCount` en los cuatro flujos que validan hojas.
- [x] 2.3 Al crear un nodo, heredar `branch_level_count` del padre y rechazar niveles fuera de la rama.
- [x] 2.4 Validar `branchLevelCount` en la creación de nivel 1: entre 1 y el máximo de la estructura.
- [x] 2.5 Rechazar la reducción de profundidad con hijos más profundos (`409 branch_has_deeper_children`).
- [x] 2.6 Permitir el aumento de 2 a 3 con hijos de nivel 2 existentes, sin tocar las referencias ya guardadas.
- [x] 2.7 Pruebas de regresión: pases, invitaciones, residentes y membresías siguen aceptando las mismas hojas que antes.

## 3. Tipos por nivel

- [x] 3.1 Exportar `LEVEL_1_NODE_TYPES` y `LEVEL_2_NODE_TYPES` desde `@porteria/shared`, alfabéticos y con `other`.
- [x] 3.2 Aceptar `nodeType` y `nodeTypeLabel` en el alta y la edición de nodos, validando contra el catálogo del nivel.
- [x] 3.3 Devolver `nodeType` y `nodeTypeLabel` en el listado de nodos y de unidades.
- [x] 3.4 Cambiar la etiqueta del formulario a "Tipo de {nombre del nivel}".
- [x] 3.5 Reemplazar la lista fija de `lib/section-types.ts` por los catálogos compartidos, manteniendo la lectura del valor legado.
- [x] 3.6 Dejar el tipo opcional en niveles 2 y 3, con el selector vacío y sugerido.

## 4. Generación semiautomática

- [x] 4.1 Implementar `planNodeGeneration` en `@porteria/shared` con modos `sequential` y `floors`, límites y conflictos.
- [x] 4.2 Tests unitarios del planificador: prefijo, padding, pisos, límites y conflictos.
- [x] 4.3 Implementar `POST /api/location-units/generate` con `dryRun`, validación de alcance y transacción única.
- [x] 4.4 Emitir `location_node.bulk_created` con el conteo y el padre.
- [x] 4.5 Integración: plan, previsualización, creación atómica y rollback por conflicto.

## 5. Dashboard

- [x] 5.1 Renombrar la pestaña "Árbol" a "Esquema" y actualizar los textos que la mencionan.
- [x] 5.2 Agregar al formulario de nivel 1 las casillas "Usa nivel 2" y "Usa nivel 3" según el máximo de la estructura.
- [x] 5.3 Agregar el paso "Una sola / Varias" con los parámetros del modo y la tabla de vista previa.
- [x] 5.4 Mostrar los conflictos de la vista previa y bloquear el guardado.
- [x] 5.5 Refrescar el esquema y el listado de unidades después de generar.

## 6. Cierre

- [ ] 6.1 E2E: crear un nivel 1 de dos niveles, generar 5 pisos × 6 unidades y verificar el listado.
- [ ] 6.2 E2E: renombrar la pestaña y comprobar "Tipo de {nivel}".
- [ ] 6.3 `eslint`, `tsc`, `pnpm --filter @porteria/api test` e `test:integration`.
- [ ] 6.4 `openspec validate improve-structure-authoring --strict` y actualizar `docs/` del flujo de estructura.
