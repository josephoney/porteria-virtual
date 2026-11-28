## Why

Armar la estructura de una comunidad es la tarea más pesada del onboarding y hoy tiene tres
fricciones concretas:

1. La pestaña se llama **"Árbol"**, un término técnico que no es el que usa el administrador.
2. El formulario dice **"Tipo de sección"** aunque el nivel 1 puede llamarse "Torre",
   "Edificio" o lo que la comunidad haya configurado. Además la lista de tipos es corta y
   solo existe para el nivel 1; los niveles 2 y 3 no tienen tipo.
3. Una comunidad tiene **una sola profundidad** (`level_count`), pero en la realidad
   conviven ramas de 2 y de 3 niveles: un club con un hotel (nivel 1) que tiene oficinas y
   habitaciones (nivel 2) y cada oficina/habitación como nivel 3, junto a torres (nivel 1)
   con apartamentos (nivel 2) que no usan el tercero.
4. Crear 50 casas o 5 pisos × 6 apartamentos obliga a escribir cada unidad a mano.

## What Changes

- Renombrar la pestaña **"Árbol" → "Esquema"**.
- El tipo del nodo usa el **nombre configurado del nivel**: "Tipo de Torre", "Tipo de Piso",
  "Tipo de Apartamento", en vez de "Tipo de sección".
- **Catálogos de tipo por nivel**, en orden alfabético y con "Otro" para texto libre:
  - Nivel 1: Ala, Bloque, Edificio, Etapa, Interior, Manzana, Módulo, Núcleo, Pabellón,
    Piso, Sector, Torre, Unidad, Villa, Zona, Zona común.
  - Niveles 2 y 3: Apartamento, Bodega, Casa, Consultorio, Cuarto útil, Depósito,
    Habitación, Local, Lote, Oficina, Parqueadero, Suite, Terraza, Unidad.
- **Profundidad por rama**: la estructura define hasta 3 niveles; cada objeto de nivel 1
  declara si usa 2 o 3 (casillas para nivel 2 y nivel 3). Una torre con dos niveles no
  admite hijos de nivel 3 y sus hijos de nivel 2 son hojas.
- **Generación semiautomática**: al crear un nivel 1 o 2, un paso opcional genera las
  unidades con vista previa:
  - secuencial con prefijo: `Casa 1 … Casa 50`;
  - por pisos: 5 pisos × 6 unidades → `101 … 106`, `201 … 206`, … `501 … 506`.
- Nuevo endpoint de generación con `dryRun`, transaccional y auditado.

**Non-goals:**

- Editar o mover ramas existentes a otra profundidad desde este change (se valida y se
  rechaza si ya hay hijos incompatibles).
- Plantillas de estructura guardadas por comunidad.
- Importación de estructura por CSV (queda para un change posterior).
- Cambiar el flujo de pases, invitaciones o residentes: solo se ajusta la regla de hoja.

**Prioridad:** accesorio. Se entrega en fases y no bloquea la operación actual.

## Capabilities

### New Capabilities

- `structure-bulk-generation`: planificación, vista previa y creación atómica de varias
  unidades con esquemas de numeración.

### Modified Capabilities

- `structure-workspace`: renombre de la pestaña, tipo por nivel y selección de profundidad
  de la rama.
- `location-hierarchy`: profundidad por rama y tipo de nodo por nivel; la regla de hoja
  pasa a depender de la rama.
- `database-schema`: columnas nuevas (`branch_level_count`, `node_type`,
  `node_type_label`) y backfill.
- `shared-types`: catálogos de tipos y DTOs de generación.

## Impact

- **Base de datos**: migración con tres columnas y backfill; `level_count` sigue siendo el
  máximo de la estructura.
- **API**: `POST /api/location-units/generate`; validación de profundidad en el alta y la
  edición; `validateLocationUnit` deja de comparar contra `structure.level_count`.
- **Shared**: `LEVEL_1_NODE_TYPES`, `LEVEL_2_NODE_TYPES`, `planNodeGeneration` (puro y
  testeable), DTOs.
- **Dashboard**: `SectionsPage` (pestaña), `StructureTreeWorkspace` (etiqueta y
  profundidad), nuevo paso de generación en el diálogo.
- **Riesgos principales**: la regla de hoja es transversal (pases, invitaciones,
  residentes); el backfill debe dejar el comportamiento idéntico al actual.
