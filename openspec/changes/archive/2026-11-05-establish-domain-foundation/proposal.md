## Why

El modelo de dominio actual está centrado en kioscos, no en comunidades: no existen
edificios, unidades ni la relación residente↔unidad, cada usuario tiene un único rol
global, y el signaling usa `buildingId` como sinónimo de `kioskId`. Esto bloquea todos
los módulos de la plataforma (control de acceso, app residente, visitas, reservas,
cartera, multi-comunidad). Antes de agregar funcionalidad hay que establecer una base
multi-tenant correcta.

## What Changes

- **BREAKING** Reemplazar `locations` por `communities` (una comunidad = un condominio
  o edificio) y agregar `buildings` (torres) y `units` (apartamentos/unidades).
- **BREAKING** Reemplazar el rol único de `users` (`role`, `organizationId`,
  `locationId`) por `memberships`: un usuario puede pertenecer a varias organizaciones,
  comunidades y unidades, con un rol por alcance.
- **BREAKING** Ampliar los roles a: `super_admin`, `org_admin`, `community_admin`,
  `operator`, `guard`, `resident`, `owner`, `tenant`, `staff`.
- **BREAKING** Corregir el acoplamiento `buildingId = kioskId`: los kioscos se vinculan
  a una comunidad y a un punto de acceso; el `buildingId` de signaling deja de ser el
  id del kiosco.
- **BREAKING** Actualizar los claims del JWT para incluir el contexto de membresía
  activo (`orgId`, `communityId?`, `membershipId`, `role`).
- **BREAKING** Reconciliar el tipo `Call` de `@porteria/shared` con el schema real
  (`locationId`/`accessPointId` nullable, sin campos inexistentes).
- Actualizar RBAC, servicios, rutas y seed para operar sobre el nuevo modelo.
- Dejar preparado el modelo para las fases siguientes (acceso, visitas, finanzas) sin
  implementar esas funcionalidades todavía.

**Non-goals:** no se agregan módulos nuevos (acceso, visitas, pagos), no se cambia el
stack, no se implementa migración de datos históricos de producción (solo migración
estructural del esquema de desarrollo).

## Capabilities

### New Capabilities

- `tenancy-model`: jerarquía `organization` (tenant) → `community` → `building` →
  `unit`, con aislamiento por organización y reglas de borrado en cascada.
- `membership-rbac`: membresías usuario↔organización/comunidad/unidad con rol por
  alcance, resolución del contexto activo y autorización por recurso.
- `unit-registry`: registro de unidades y ocupación (propietario/inquilino/familia),
  base para residentes, vehículos, mascotas y cartera.

### Modified Capabilities

- `database-schema`: nuevas tablas (`communities`, `buildings`, `units`,
  `memberships`) y migración de `locations`/`users`.
- `jwt-auth`: claims de contexto de membresía y validación de organización activa.
- `user-management`: gestión de membresías y roles por alcance en lugar de rol único.
- `shared-types`: nuevos tipos/enums de tenencia, unidades y membresías; corrección de
  `Call`.
- `kiosk-management-api`: kioscos asociados a comunidad y punto de acceso; listado y
  métricas por comunidad.
- `seed-data`: seed multi-tenant con dos organizaciones y comunidades de ejemplo.

## Impact

- **Database**: `packages/database/src/schema/*` (nuevas tablas, migración de
  `locations`, cambios en `users`, `kiosks`, `calls`), `seed.ts`.
- **API**: `server/api/src/routes/*` (users, kiosks, calls, reports, events),
  `middlewares/rbac.ts`, `plugins/auth.ts`, `services/*`.
- **Signaling**: `server/signaling/src/*` (resolución de kiosco por comunidad,
  `buildingId` deja de ser `kioskId`; payloads y persistencia).
- **Shared**: `packages/shared/src/types/*`, `enums/*`, `dto/*`.
- **Frontend**: dashboard (login, contexto de organización/comunidad, filtros por
  comunidad) y tipos compartidos.
- **OpenSpec**: nuevos specs `tenancy-model`, `membership-rbac`, `unit-registry` y
  deltas de los specs modificados.
