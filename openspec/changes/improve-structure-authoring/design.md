## Context

Hoy `location_structures` define `levelCount` (1–3) y nombres por nivel; `location_units`
guarda `levelPosition` y `parentId`. La hoja se decide en un solo lugar:

```ts
// server/api/src/services/location-unit.service.ts
if (row.levelPosition !== row.levelCount) return { ok: false, code: 'not_leaf' };
```

Esa comparación es la que usan las membresías de ocupantes, las invitaciones, los pases y
los residentes. Por eso cambiar la profundidad **por rama** es la decisión más delicada del
change: si se hace mal, se rompen cuatro flujos.

El tipo de sección existe solo para nivel 1 (`section_type` es un enum de Postgres con 12
valores) y la UI lo etiqueta "Tipo de sección" aunque el nivel se llame "Torre".

## Goals / Non-Goals

**Goals:**

- Terminología del administrador: "Esquema", "Tipo de {nombre del nivel}".
- Catálogos de tipo por nivel, alfabéticos y ampliables sin migración.
- Que una misma comunidad tenga ramas de 2 y de 3 niveles sin conflicto.
- Crear decenas de unidades en un paso, con vista previa y sin duplicados.

**Non-Goals:**

- Importar estructura desde CSV.
- Plantillas por comunidad.
- Reparentar ramas existentes entre profundidades.
- Cambiar el contrato de pases, invitaciones o residentes (solo su fuente de verdad de hoja).

## Decisions

### 1. Profundidad por rama en `branch_level_count`, replicada en cada nodo

**Decisión:** nueva columna `location_units.branch_level_count` (smallint, nullable). En el
nodo de nivel 1 guarda 1, 2 o 3; los descendientes la heredan al crearse.
`location_structures.level_count` pasa a ser el **máximo** de la estructura.

La hoja se decide así:

```ts
const leafLevel = node.branchLevelCount ?? structure.levelCount;
const isLeaf = node.levelPosition === leafLevel;
```

**Por qué replicarla en cada nodo:** `validateLocationUnit` y los listados ya leen la fila;
con la columna no necesitan subir hasta la raíz para saber si es hoja. Sin la réplica, cada
validación de pase haría un join recursivo.

**Backfill:** `branch_level_count = level_count` de su estructura. Con eso **ningún dato
existente cambia de comportamiento**.

**Alternativas descartadas:**

- *Hoja = "no tiene hijos"*: mientras se construye la estructura, un piso recién creado
  parece hoja y admitiría un pase. Inaceptable.
- *Columna solo en el nodo raíz*: obliga a resolver la raíz en cada consulta de hoja.

### 2. Tipo de nodo como texto con catálogo en el paquete compartido

**Decisión:** columnas nuevas `node_type` (text) y `node_type_label` (text) en
`location_units`; catálogos `LEVEL_1_NODE_TYPES` y `LEVEL_2_NODE_TYPES` en
`@porteria/shared`. `section_type`/`section_type_label` quedan como legado de lectura.

**Por qué no extender el enum:** cada tipo nuevo exigiría una migración de `ALTER TYPE`, y
la lista es de producto, no de base de datos.

**Backfill:** `node_type = section_type`, `node_type_label = section_type_label` en nivel 1.
Los niveles 2 y 3 quedan con `node_type` nulo hasta que se editen (opcional, no obligatorio).

**"Otro":** guarda `node_type = 'other'` y el texto libre en `node_type_label`.

### 3. La etiqueta usa el nombre del nivel

**Decisión:** el formulario dice "Tipo de {levelName}" con el nombre configurado
("Tipo de Torre", "Tipo de Piso", "Tipo de Apartamento").

**Por qué:** "Tipo de sección" solo era correcto con la configuración por defecto; con
niveles renombrados el texto mentía.

### 4. Profundidad elegida al crear el nivel 1

**Decisión:** al crear un objeto de nivel 1, dos casillas: "Usa nivel 2" y "Usa nivel 3",
con el máximo de la estructura como techo. Sin nivel 2, el nodo es hoja. Sin nivel 3, sus
hijos de nivel 2 son hojas.

**Por qué:** es el caso real del club (hotel de 3 niveles, torres de 2) sin obligar a
duplicar estructuras ni a inventar un tercer nivel vacío.

**Validación al reducir:** si la rama ya tiene hijos en un nivel que se desactivaría,
responde `409 branch_has_deeper_children` y no cambia nada.

**Alternativa descartada:** crear estructuras separadas por profundidad. Duplicaría
comunidades y rompería la unicidad de nombres.

### 5. Generación: un plan puro, un endpoint atómico

**Decisión:** `planNodeGeneration(input)` en `@porteria/shared` (función pura, sin I/O)
devuelve los nodos a crear y los conflictos detectados. El endpoint
`POST /api/location-units/generate` acepta `dryRun`:

- `dryRun: true` → devuelve el plan y los conflictos, sin escribir.
- `dryRun: false` → revalida, inserta todo en **una transacción** y emite un único evento
  `location_node.bulk_created` con el conteo.

**Por qué un plan puro:** permite previsualizar en el cliente con exactamente la misma
lógica que ejecuta el servidor, y testear la numeración sin base de datos.

**Modos:**

| Modo | Entrada | Resultado |
|---|---|---|
| `sequential` | `count`, `prefix`, `start`, `padding`, `suffix` | `Casa 1 … Casa 50` |
| `floors` | `floors`, `perFloor`, `floorPrefix`, `unitPrefix`, `unitPadding` | `Piso 1…5` y `101…106, 201…206, …` |

**Límites:** 300 nodos por llamada, 50 pisos, 50 unidades por piso. Todo o nada: si un
nombre choca con un hermano existente, no se crea ninguno y se devuelven hasta 5 conflictos.

**Por qué atómico:** dejar media torre creada es peor que fallar; el administrador vuelve a
previsualizar y corrige.

### 6. Dónde se ofrece la generación

**Decisión:** el diálogo de creación de un nodo gana un paso "Crear unidades": "una sola" o
"varias". Con "varias" y modo `floors`, crear un nivel 1 de 3 niveles genera también los
niveles 2 y 3 en la misma llamada.

**Por qué:** es el caso del ejemplo (club → hotel → oficinas/habitaciones) y evita crear
piso por piso.

### 7. Aumentar la profundidad de una rama sí; reducirla con hijos no

**Decisión:** una rama de 2 niveles puede pasar a 3 aunque ya tenga hijos de nivel 2. Sus
hijos dejan de ser hojas y pasan a admitir descendientes. La operación inversa (3 → 2) se
rechaza mientras existan nodos en el nivel 3 (`409 branch_has_deeper_children`).

**Por qué:** el caso real es una torre que arranca con apartamentos y después se subdivide
en habitaciones; obligar a borrar la rama para crecer sería peor.

**Consecuencia sobre datos existentes:** la regla no es retroactiva. Un apartamento que ya
tenía residentes o pases conserva esas referencias; lo que cambia es que **ya no admiten
referencias nuevas**, porque pases, invitaciones y residentes exigen hoja. Se documenta y se
prueba en la fase 2.

### 8. El tipo es opcional en niveles 2 y 3

**Decisión:** `nodeType` es opcional en todos los niveles, pero la interfaz lo sugiere: en
nivel 1 se mantiene el valor por defecto y en los niveles 2 y 3 el selector arranca vacío con
la etiqueta "Tipo de {nivel}". Solo "Otro" exige texto libre.

**Por qué:** en una estructura de tres niveles el tipo del piso suele ser obvio y exigirlo
agrega fricción a la creación masiva; el tipo del nivel 1 sí identifica la sección y se usa
en los listados.

## Risks / Trade-offs

- **[Riesgo] La hoja es transversal** (membresías, invitaciones, pases, residentes) →
  backfill idéntico al comportamiento actual, pruebas de regresión en los cuatro flujos y
  un helper único `resolveLeafLevel`.
- **[Riesgo] Datos con `section_type` nulo** → el backfill solo copia lo que existe; los
  nodos sin tipo siguen sin tipo y la UI muestra "—".
- **[Riesgo] Reducir la profundidad de una rama con hijos** → `409
  branch_has_deeper_children`, sin cambios parciales.
- **[Riesgo] Numeración ambigua** (¿101 es piso 1 unidad 01?) → el plan muestra los nombres
  y el usuario confirma antes de crear.
- **[Trade-off] `section_type` queda como legado** → se mantiene por compatibilidad de
  lectura y se elimina en un change posterior.
- **[Riesgo] Muchos nodos por llamada** → límite duro de 300 y una sola transacción.

## Migration Plan

1. **Migración** (aditiva): `branch_level_count`, `node_type`, `node_type_label`; backfill
   desde la estructura y desde `section_type`. Sin `NOT NULL` para no romper inserts viejos.
2. **API**: regla de hoja por rama, validación de profundidad, endpoint de generación.
3. **Dashboard**: renombre, etiqueta por nivel, catálogos, casillas de profundidad, paso de
   generación.
4. **Rollback**: el código anterior ignora las columnas nuevas; no hay que revertir datos.

## Open Questions

- ¿"Unidad" debe seguir en el catálogo de nivel 1? Se incluye porque el negocio lo pidió,
  aunque en la mayoría de los casos corresponde al nivel hoja. Se puede quitar sin
  migración si molesta.
