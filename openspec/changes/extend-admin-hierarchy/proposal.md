## Why

La jerarquía actual es parcial: el platform admin crea organizaciones/comunidades, pero
no administra operadores/guardias desde la consola; el org_admin no puede crear
comunidades; el community_admin no tiene una consola clara para estructura, residentes y
permisos; y no hay reportes globales por organización/community. Además, los permisos no
están expresados como una matriz única y verificable.

## What Changes

- Formalizar la jerarquía:
  **Superadmin → Organización → Comunidad → Ubicaciones → Usuarios**.
- Definir la matriz de permisos por rol y alcance.
- **Superadmin**:
  - crear organizaciones y asignar el primer org admin;
  - consultar organizaciones, comunidades, perfiles, secciones y unidades en modo lectura;
  - consultar usuarios globales;
  - crear/administrar operadores y guardias;
  - asociarlos a una organización y a una o varias comunidades;
  - consultar reportes globales.
- **Org Admin**:
  - administrar la información de su organización;
  - crear/administrar comunidades de su organización;
  - administrar todas las comunidades de su organización sin necesitar membership de community admin;
  - administrar usuarios y community admins;
  - consultar reportes de su organización.
- **Community Admin**:
  - administrar las comunidades asignadas;
  - puede tener memberships en varias comunidades;
  - administrar la estructura de ubicaciones;
  - gestionar residentes;
  - administrar usuarios y permisos dentro de sus comunidades;
  - no crear comunidades ni organizaciones.
- Asegurar que todo permiso esté limitado por organización y comunidad.
- **Non-goals:** no se implementa la jerarquía configurable de ubicaciones (propuesta 4),
  ni la separación persona/cuenta (5), ni subusuarios (6). Esta propuesta define la
  jerarquía administrativa y las reglas de permisos.

## Capabilities

### New Capabilities

- `admin-hierarchy`: jerarquía, matriz de permisos, consolas y reportes por alcance.

### Modified Capabilities

- `membership-rbac`: poderes administrativos por alcance.
- `platform-console`: administración de operadores/guardias y reportes globales.

## Impact

- **API**: RBAC, usuarios, memberships, comunidades, reportes, dashboard stats.
- **Dashboard**: navegación y consolas por rol/alcance.
- **DB**: nuevas asociaciones staff↔comunidad (una o varias) y permisos explícitos.
- **Depende de:** `add-configurable-location-hierarchy` y
  `separate-people-and-accounts`.
- **Prioridad:** P1, después de las propuestas 4 y 5.
