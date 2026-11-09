## Why

La fundación multi-tenant ya existe (organización → comunidad → torre → unidad +
membresías), pero la **entrada al sistema sigue siendo genérica**: todos usan el mismo
login, no hay forma de entrar por el portal de una comunidad, y no existe una consola
para que el superadministrador cree la estructura inicial. Tampoco hay un onboarding
seguro para residentes: hoy habría que crearles la cuenta a mano o dejarlos elegir una
unidad, lo cual es un riesgo.

## What Changes

- Agregar **slug único** a organizaciones y comunidades, con generación, validación y
  lista de palabras reservadas.
- Exponer un **endpoint público** `GET /api/public/communities/:slug` para resolver la
  comunidad y su branding básico (nombre, dirección, zona horaria, organización).
- Implementar **entrada con slug en path** (`/c/:slug`) en el dashboard: la comunidad se
  conoce antes del login y la autenticación queda **acotada a esa comunidad**.
- Extender el login para aceptar `communitySlug` opcional: si el usuario tiene una
  membresía en esa comunidad entra directo; si tiene varias, elige entre esas; si no
  tiene ninguna, 403.
- Crear **invitaciones** de onboarding por email + comunidad + unidad + rol, con token
  de un solo uso, expiración, revocación y reenvío.
- Implementar el **flujo de aceptación**: usuario nuevo crea contraseña; email
  existente requiere autenticación previa (nunca permite cambiar la contraseña de otro).
- Crear la **consola de plataforma** (`/platform`) y sus endpoints `/api/platform/*`
  para que el superadministrador gestione organizaciones, comunidades, torres y
  unidades, y emita la primera invitación de `org_admin`.
- Actualizar el seed con slugs demo e invitaciones de ejemplo.
- **Non-goals:** no se implementan subdominios, branding avanzado (logo/colores), SSO,
  autoregistro con verificación ni envío de emails real (Fase 1 devuelve el link de
  invitación al administrador; el proveedor de email queda para
  `add-notification-service`).

## Capabilities

### New Capabilities

- `tenant-slug-resolution`: slugs de organización/comunidad, reglas de formato, palabras
  reservadas, generación con colisiones y endpoint público de resolución.
- `community-scoped-login`: entrada por `/c/:slug`, branding público, login acotado a la
  comunidad y resolución de membresías dentro de ese contexto.
- `invitation-onboarding`: modelo de invitaciones, creación/revocación/reenvío,
  aceptación, creación de cuenta y reglas de seguridad.
- `platform-console`: API y UI de plataforma para CRUD de organizaciones, comunidades,
  torres y unidades, más invitación del primer `org_admin`.

### Modified Capabilities

- `database-schema`: columnas `slug` en `organizations` y `communities`; nueva tabla
  `invitations`.
- `shared-types`: tipos y DTOs de slug, branding público e invitaciones.
- `jwt-auth`: el login acepta `communitySlug` opcional y acota la resolución de
  membresías a esa comunidad.

## Impact

- **Database**: `packages/database/src/schema/{organizations,communities,invitations}.ts`,
  migración nueva, seed.
- **API**: `server/api/src/modules/tenant/*`, `modules/platform/*`,
  `modules/invitations/*`, rutas públicas y `/api/platform/*`; ajustes en
  `auth.service.ts` y `routes/auth.routes.ts`.
- **Shared**: `packages/shared/src/{types,dto,index.ts}`.
- **Dashboard**: ruta pública `/c/:slug`, página `/platform`, navegación y guards.
- **OpenSpec**: 4 specs nuevas y 3 deltas de specs existentes.
- **Depende de**: `establish-domain-foundation` (archivado).
