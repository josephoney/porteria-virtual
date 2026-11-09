## Why

El modelo actual usa `buildings` y `units` rígidos. No permite jerarquías como
Edificio→Piso→Oficina, Torre→Piso→Apartamento, Sector→Manzana→Casa o Sede→Departamento→
Área, ni nombres personalizados, ni estructuras distintas dentro de una misma comunidad.
Esto bloquea la administración flexible y la asociación de residentes a ubicaciones.

## What Changes

- Crear un modelo genérico de **estructuras de ubicación** por comunidad:
  - `location_structures`: nombre, cantidad de niveles (1–3) y nombres personalizados de
    cada nivel.
  - `location_units`: nodos genéricos con `parent_id`, `level_position`, nombre, código,
    metadata y estado.
- Exponer el nivel 1 como **Sección**: cada sección es un agrupador concreto dentro de
  la comunidad (Torre A, Zona Común, Sede) y puede tener subniveles y unidades.
- Agregar `section_type` a las secciones con un catálogo fijo:
  `tower`, `interior`, `building`, `zone`, `block`, `sector`, `floor`, `house`, `lot`,
  `commercial`, `other`. Para `other`, exigir `section_type_label`.
- El tipo de sección es semántica/UI/filtro: no cambia la cantidad de niveles ni las
  reglas del árbol. No se infiere del nombre.
- Permitir **múltiples estructuras** dentro de una comunidad (ej. torre residencial y
  sector comercial), cada una con sus propios nombres de nivel.
- Permitir crear/editar niveles y nodos, mover nodos y renombrar sin perder relaciones.
- Asociar **residentes** a una o varias ubicaciones (persona ↔ ubicación) con relación
  (propietario, inquilino, residente, familiar, staff) y vigencia.
- Migrar `buildings`/`units` existentes a una estructura por defecto sin perder datos:
  cada `building` se convierte en una Sección con `section_type = 'building'`; el admin
  puede cambiar el tipo después.
- **Non-goals:** no se modifica el QR dinámico (propuesta 7), ni el modelo de
  persona/cuenta (5), ni subusuarios (6), ni la consola administrativa (3), ni el
  sistema de temas.

## Capabilities

### New Capabilities

- `location-hierarchy`: estructuras, niveles personalizables, secciones tipadas, nodos
  genéricos, restricciones, CRUD, listado para consola, asociación de residentes y
  migración.

### Modified Capabilities

- `unit-registry`: `buildings`/`units` fijos quedan deprecados y migrados.

## Impact

- **DB**: `location_structures`, `location_units`, `location_residents`;
  `section_type`/`section_type_label` en secciones; migración de `buildings`/`units`;
  índices y constraints.
- **API**: CRUD de estructuras/niveles/nodos, listado paginado de secciones y
  asociaciones de residentes.
- **Shared**: tipos/DTOs de estructura, nodo y tipo de sección.
- **Dashboard**: administración de estructura por comunidad y tabla de Secciones.
- **QR**: queda desacoplado por ahora; proposal 7 actualiza `unitId` → `locationUnitId`.
- **Depende de:** `separate-people-and-accounts` para `person_id` en residentes.
- **Prioridad:** P1, antes de la jerarquía administrativa (3), del QR (7) y de la
  reorganización de la consola administrativa.
