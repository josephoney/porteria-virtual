## Why

Dos huecos del modelo actual bloquean el piloto:

1. **No hay ubicación administrativa.** `organizations` y `communities` guardan `address`, pero no `municipality`, `department` ni `country`. Para una organización que opera en varias ciudades, o para reportes y facturación, la dirección en texto libre no alcanza: no se puede agrupar, filtrar ni validar.
2. **El superadministrador no puede corregir una organización.** Una vez creada, `POST /api/platform/organizations` es la única vía y `PATCH /api/platform/organizations/:id` solo acepta `name` y `slug` desde el código, sin UI. Si el nombre está mal escrito o el administrador de la organización cambia, no hay forma de resolverlo desde el dashboard.

El primer punto es de datos y formularios. El segundo es de operación: sin edición, cualquier error de alta requiere intervención manual en la base.

## What Changes

- **Geografía en organizaciones y comunidades**: se agregan `municipality`, `department` y `country` (`varchar(120)`, nullable) a ambas tablas, con migración sin backfill. Los registros existentes quedan `null` y se muestran como “—”.
- **Formularios**: Mi Organización, creación de organización de plataforma y creación/edición de comunidad incorporan los tres campos. `country` es un select con lista estática de países y valor por defecto “Colombia”.
- **Contrato de API**: `createOrganizationSchema`, `updateOrganizationSchema`, `createCommunitySchema`, `updateCommunitySchema` y el body de `PATCH /api/organizations/me` aceptan los tres campos; las lecturas (`GET /api/organizations/me`, `GET /api/platform/organizations/:id/overview`, `GET /api/communities/:id/overview`) los devuelven.
- **Edición de organización desde plataforma**: el diálogo **Editar** de la tabla de Organizaciones (creado en `polish-admin-workspace` con nombre y slug) suma el administrador actual y un campo para cambiarlo por email. `PATCH /api/platform/organizations/:id` acepta `{ name?, slug?, administratorEmail? }`.
- **Transferencia de administrador**: si el email ya tiene cuenta, la transferencia es inmediata; si no, se crea una invitación `org_admin` y el administrador actual sigue activo hasta que se acepte.

## Capabilities

### New Capabilities

- `organization-geography`: columnas, contratos de API, formularios y visualización de municipio, departamento y país.

### Modified Capabilities

- `platform-console`: el requisito **Organization management** incorpora la edición de nombre y la transferencia de administrador, y se agrega el requisito **Organization administrator transfer**.

## Impact

- `packages/database/src/schema/organizations.ts`
- `packages/database/src/schema/communities.ts`
- `packages/database/migrations/0016_*.sql` (nueva)
- `packages/shared/src/types/organization.ts`
- `packages/shared/src/types/community.ts`
- `server/api/src/schemas/index.ts`
- `server/api/src/routes/organization-admin.routes.ts` (`GET/PATCH /me`, `POST /me/communities`)
- `server/api/src/routes/communities.routes.ts` (`PATCH /:id`, `GET /:id/overview`)
- `server/api/src/routes/platform.routes.ts` (`POST /organizations`, `PATCH /organizations/:id`, `GET /organizations/:id/overview`)
- `server/api/src/services/invitation.service.ts` (desactivar `org_admin` anterior al aceptar)
- `apps/dashboard/src/lib/countries.ts` (nuevo)
- `apps/dashboard/src/pages/MyOrganizationPage.tsx`
- `apps/dashboard/src/pages/PlatformPage.tsx`
- `apps/dashboard/src/components/admin/AdminPanel.tsx`
- `docs/api-v1-contract.md`
- Tests de integración de API y Playwright del dashboard

## Dependencias

- Reutiliza `DetailGrid`/`DetailField` y el patrón de fila expandible de `polish-admin-workspace`. El botón **Editar** de Organizaciones y su diálogo base (nombre y slug) ya existen en ese cambio; acá se extienden con administrador y geografía.

## Fuera de alcance

- Códigos ISO-3166 y catálogo de países en base de datos; el MVP guarda el nombre del país.
- Catálogos de departamentos y municipios, o validación cruzada país → departamento → municipio.
- Geocodificación, autocompletado de direcciones o mapas.
- Derivar la zona horaria de la geografía.
- Cambiar el nombre de la organización desde Mi Organización.
- Historial de administradores anterior al cambio; solo se audita el evento.
