## Context

`UnitsPage` lista unidades con filtros por comunidad, sección, estado y búsqueda, y ya
ofrece invitar residentes y carga masiva. La creación vive solo en
`StructureTreeWorkspace`, que crea nodos con `POST /api/location-units`
(`communityId` + `parentId` o `structureId` + `name` + `code`).

Cada comunidad tiene **una** estructura con `levelCount` (1 a 3), `level1Name`,
`level2Name` y `level3Name`. Una unidad es un nodo en el nivel `levelCount`; su padre está
en el nivel anterior.

## Goals / Non-Goals

**Goals:**

- Crear una unidad desde el listado con los mismos permisos y validaciones que el árbol.
- Pedir únicamente lo necesario: comunidad, sección, niveles intermedios si existen,
  nombre y código.
- Ver la unidad nueva sin recargar.

**Non-Goals:**

- Editar, archivar o eliminar desde esta página.
- Crear secciones o niveles intermedios.
- Cambiar el diálogo del árbol.

## Decisions

### 1. Reutilizar `POST /api/location-units`, sin endpoint nuevo

**Por qué:** el árbol ya valida estructura, nivel del padre, alcance y código duplicado.
Un endpoint "de unidades" duplicaría esas reglas y se desincronizaría.

### 2. Selects en cascada según `levelCount`

**Decisión:** el diálogo pide un padre por cada nivel anterior a la hoja: sección, y
luego los intermedios que existan. El último seleccionado es el `parentId`.

**Por qué:** con dos niveles basta comunidad + sección (el caso que motivó el pedido); con
tres, la sección sola no determina la hoja y el servidor rechazaría el nivel.

**Alternativa descartada:** un único select "sección" y crear siempre bajo ella. Falla en
estructuras de tres niveles y deja unidades en el nivel equivocado.

### 3. Estructura de un solo nivel

**Decisión:** si `levelCount === 1`, la unidad es un nodo raíz y se envía `structureId`
en lugar de `parentId`.

**Por qué:** es el único caso donde la hoja no tiene padre; el endpoint ya lo contempla.

### 4. Permisos y alcance

**Decisión:** la acción se muestra a `org_admin` y `community_admin`; el platform admin no
la ve (es read-only sobre tenant) y el backend igual responde `403`.

**Por qué:** coincide con lo que ya hace el árbol y evita un botón que siempre falla.

### 5. Refresco con la caché de consultas

**Decisión:** invalidar la clave `['units']` de TanStack Query al guardar.

**Por qué:** la página ya usa esa librería; invalidar evita recargar y mantiene los
filtros aplicados.

## Risks / Trade-offs

- **[Riesgo] Estructura sin nodos previos** → los selects de nivel 2 quedan vacíos y el
  diálogo lo explica, con enlace a Estructura.
- **[Riesgo] Código duplicado** → el servidor responde `409`; el diálogo muestra el
  mensaje sin cerrar.
- **[Riesgo] Comunidad sin estructura** → el diálogo lo informa y deshabilita el guardado.
- **[Trade-off] Solo nivel hoja** → crear niveles intermedios sigue siendo tarea del
  árbol, que es donde se ve la jerarquía completa.

## Migration Plan

1. Diálogo y acción en la página; sin cambios de API.
2. Rollback: quitar el botón y el componente; no hay datos ni migración que revertir.
