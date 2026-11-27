## Why

El "puesto de trabajo" del guardia existe a medias. `memberships.default_access_point_id`
ya está en el esquema desde el change de turnos y `GuardPanel` lo lee, pero ningún cliente
puede asignarlo: la única vía es un `PATCH /api/memberships/:id` a mano, sin validación por
rol ni auditoría, y ninguna pantalla muestra quién está asignado a cada portería.

El spec `guard-dashboard` ya promete que un admin puede asignar el acceso por defecto al
editar una membresía de guardia, y `docs/onboarding-comunidad.md` indica ese campo en
Admin → Usuarios. La promesa está escrita, pero no tiene interfaz ni contrato de API.

## What Changes

- **Recurso de asignación de puesto**, por membresía (una por guardia y comunidad):
  - `PUT /api/memberships/:id/workstation` con `{ accessPointId | null }`;
  - `GET /api/me/workstation` para que el guardia lea su puesto;
  - `GET /api/communities/:id/access-points/:accessPointId/guards` con los guardias
    asignados y, si lo tienen, su turno abierto.
- **Reglas explícitas** (hoy inexistentes o dispersas):
  - solo membresías con rol `guard`;
  - la membresía debe tener comunidad;
  - el acceso debe pertenecer a esa comunidad y estar activo;
  - `null` desasigna y es idempotente;
  - cambiar el puesto **no** mueve un turno abierto: el turno manda y el cambio aplica al
    siguiente.
- **Auditoría**: `admin.workstation.assigned` / `admin.workstation.unassigned` con actor,
  membresía, puesto anterior y nuevo.
- **Dashboard**:
  - acción de fila "Puesto de trabajo" en Usuarios, con selector de accesos activos,
    opción "Sin asignar" y aviso si el guardia tiene turno abierto;
  - columna y detalle de guardias asignados en Accesos;
  - estado explícito en el panel del guardia cuando no tiene puesto asignado.
- **Asignación informativa**: el puesto preselecciona y da visibilidad al administrador,
  pero no impide que el guardia inicie turno en otro acceso activo de su comunidad.
- **Sin migración**: la columna y su índice ya existen; el cambio es de contrato y de
  interfaz.

**Non-goals:**

- Un guardia con varios puestos por membresía (el modelo es un puesto por membresía).
- Programación por franjas horarias o calendario de rotación.
- Restringir en qué accesos puede escanear o iniciar turno un guardia: la asignación es
  informativa y los grants por persona/acceso siguen en Phase 2 del change archivado de
  turnos.
- Mover o reasignar un turno abierto desde administración (solo el guardia cambia de
  acceso, o el admin lo fuerza cerrado).
- Chip del puesto en la app Zima: consumirá `GET /api/me/workstation` en un change
  posterior.

## Capabilities

### New Capabilities

- `guard-workstation-assignment`: recurso de asignación de puesto por membresía, reglas de
  rol y alcance, desasignación, lectura de guardias por acceso y auditoría.

### Modified Capabilities

- `guard-dashboard`: el selector de acceso por defecto pasa de promesa a pantalla con
  acción, validaciones y estado vacío; el panel del guardia muestra el puesto asignado.
- `guard-shifts`: la asignación es la fuente del acceso por defecto y cambiar el puesto no
  altera un turno abierto.
- `access-point-management`: desactivar un acceso conserva las asignaciones y expone
  cuántos guardias lo tienen como puesto.
- `shared-types`: tipos y DTO de la asignación de puesto.

## Impact

- **API**: `server/api/src/services/` (nuevo `workstation.service.ts` o ampliación de
  `memberships.service.ts`), `routes/memberships.routes.ts`, `routes/access-point.routes.ts`,
  `routes/users.routes.ts` (`/me/workstation`), `schemas/index.ts` y registro en `index.ts`.
- **Shared**: `packages/shared/src/{types,dto,enums}` para el puesto asignado.
- **Dashboard**: `UsersTable.tsx` (acción y diálogo), `AccessPointsPanel.tsx` (guardias
  asignados), `GuardPanel.tsx` (estado del puesto), `AuthContext.tsx` si el puesto viaja con
  la sesión.
- **Documentación**: `docs/onboarding-comunidad.md` y `docs/roles-y-permisos.md`.
- **Pruebas**: unitarias de las reglas, integración de los cuatro endpoints y E2E de la
  acción de asignación.
- **Base de datos**: sin cambios de esquema.
- **Depende de**: `add-guard-shifts-and-access-bitacora` (archivado) y del
  `default_access_point_id` existente.
