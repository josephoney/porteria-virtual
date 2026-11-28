## 1. Base de datos

- [ ] 1.1 Agregar `branch_level_count` (smallint, nullable) a `location_units` con su índice por rama.
- [ ] 1.2 Agregar `node_type` y `node_type_label` (text, nullable) a `location_units`.
- [ ] 1.3 Migración con backfill: `branch_level_count = level_count` de la estructura y `node_type = section_type`, `node_type_label = section_type_label` para nivel 1.
- [ ] 1.4 Verificar idempotencia y que el comportamiento de hoja no cambie con los datos existentes.
- [ ] 1.5 Extender `schema-migration.integration.test.ts` con las columnas y el backfill.

## 2. Regla de hoja y profundidad

- [ ] 2.1 Crear un helper único `resolveLeafLevel(node, structure)` y usarlo en `validateLocationUnit`.
- [ ] 2.2 Reemplazar la comparación `levelPosition === structure.levelCount` en los cuatro flujos que validan hojas.
- [ ] 2.3 Al crear un nodo, heredar `branch_level_count` del padre y rechazar niveles fuera de la rama.
- [ ] 2.4 Validar `branchLevelCount` en la creación de nivel 1: entre 1 y el máximo de la estructura.
- [ ] 2.5 Rechazar la reducción de profundidad con hijos más profundos (`409 branch_has_deeper_children`).
- [ ] 2.6 Permitir el aumento de 2 a 3 con hijos de nivel 2 existentes, sin tocar las referencias ya guardadas.
- [ ] 2.7 Pruebas de regresión: pases, invitaciones, residentes y membresías siguen aceptando las mismas hojas que antes.

## 3. Tipos por nivel

- [ ] 3.1 Exportar `LEVEL_1_NODE_TYPES` y `LEVEL_2_NODE_TYPES` desde `@porteria/shared`, alfabéticos y con `other`.
- [ ] 3.2 Aceptar `nodeType` y `nodeTypeLabel` en el alta y la edición de nodos, validando contra el catálogo del nivel.
- [ ] 3.3 Devolver `nodeType` y `nodeTypeLabel` en el listado de nodos y de unidades.
- [ ] 3.4 Cambiar la etiqueta del formulario a "Tipo de {nombre del nivel}".
- [ ] 3.5 Reemplazar la lista fija de `lib/section-types.ts` por los catálogos compartidos, manteniendo la lectura del valor legado.
- [ ] 3.6 Dejar el tipo opcional en niveles 2 y 3, con el selector vacío y sugerido.

## 4. Generación semiautomática

- [ ] 4.1 Implementar `planNodeGeneration` en `@porteria/shared` con modos `sequential` y `floors`, límites y conflictos.
- [ ] 4.2 Tests unitarios del planificador: prefijo, padding, pisos, límites y conflictos.
- [ ] 4.3 Implementar `POST /api/location-units/generate` con `dryRun`, validación de alcance y transacción única.
- [ ] 4.4 Emitir `location_node.bulk_created` con el conteo y el padre.
- [ ] 4.5 Integración: plan, previsualización, creación atómica y rollback por conflicto.

## 5. Dashboard

- [ ] 5.1 Renombrar la pestaña "Árbol" a "Esquema" y actualizar los textos que la mencionan.
- [ ] 5.2 Agregar al formulario de nivel 1 las casillas "Usa nivel 2" y "Usa nivel 3" según el máximo de la estructura.
- [ ] 5.3 Agregar el paso "Una sola / Varias" con los parámetros del modo y la tabla de vista previa.
- [ ] 5.4 Mostrar los conflictos de la vista previa y bloquear el guardado.
- [ ] 5.5 Refrescar el esquema y el listado de unidades después de generar.

## 6. Cierre

- [ ] 6.1 E2E: crear un nivel 1 de dos niveles, generar 5 pisos × 6 unidades y verificar el listado.
- [ ] 6.2 E2E: renombrar la pestaña y comprobar "Tipo de {nivel}".
- [ ] 6.3 `eslint`, `tsc`, `pnpm --filter @porteria/api test` e `test:integration`.
- [ ] 6.4 `openspec validate improve-structure-authoring --strict` y actualizar `docs/` del flujo de estructura.
