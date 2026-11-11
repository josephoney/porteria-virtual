# Tasks

## 1. Base de datos

- [x] 1.1 Agregar `municipality`, `department` y `country` (`varchar(120)`, nullable) a `packages/database/src/schema/organizations.ts`.
- [x] 1.2 Agregar las mismas columnas a `packages/database/src/schema/communities.ts`.
- [x] 1.3 Generar la migración `0016_*` con `pnpm --filter @porteria/database db:generate` y revisar que sean `ADD COLUMN` nullable sin `DEFAULT`.
- [x] 1.4 Aplicar la migración en local y verificar que las filas existentes quedan en `null`.

## 2. Contratos compartidos

- [x] 2.1 Extender `Organization` en `packages/shared/src/types/organization.ts` con `municipality`, `department` y `country`.
- [x] 2.2 Extender `Community` en `packages/shared/src/types/community.ts` con los mismos campos.
- [x] 2.3 Crear `geographySchema` en `server/api/src/schemas/index.ts` y extender `createOrganizationSchema`, `updateOrganizationSchema`, `createCommunitySchema` y `updateCommunitySchema`.
- [x] 2.4 Aplicar `geographySchema` al body de `PATCH /api/organizations/me` y a `POST /api/organizations/me/communities`.

## 3. API de geografía

- [x] 3.1 `PATCH /api/organizations/me` persiste los tres campos con `trim()` y `null` para vacío; incluirlos en `changedFields` del evento `organization.profile.updated`.
- [x] 3.2 `PATCH /api/communities/:id` persiste los tres campos con el mismo criterio.
- [x] 3.3 `POST /api/platform/organizations` acepta y guarda los tres campos.
- [x] 3.4 `GET /api/platform/organizations/:id/overview` agrega los tres campos al `select` de organización.
- [x] 3.5 Confirmar que `GET /api/organizations/me` y `GET /api/communities/:id/overview` devuelven los campos sin cambios adicionales.

## 4. API de edición y transferencia

- [x] 4.1 Extender `updateOrganizationSchema` con `administratorEmail: z.string().email().optional()`.
- [x] 4.2 Reescribir `PATCH /api/platform/organizations/:id` en una transacción: actualizar nombre/slug y devolver `{ organization, administrator }`.
- [x] 4.3 Implementar la transferencia inmediata cuando el email existe en `users`: resolver la membresía con `SELECT` explícito (no `onConflictDoNothing`), insertar o reactivar, y desactivar las demás `org_admin` activas de la organización.
- [x] 4.4 Revocar invitaciones `org_admin` pendientes de la organización antes de crear una nueva.
- [x] 4.5 Implementar la transferencia pendiente cuando el email no existe: crear invitación con `createInvitation` y devolver `acceptUrl` una sola vez; no desactivar al administrador actual.
- [x] 4.6 No hacer transferencia cuando el email normalizado coincide con el administrador activo.
- [x] 4.7 Auditar `organization.updated` y `organization.administrator_changed` con `{ from, to, pending }`.
- [x] 4.8 En `acceptInvitation`, al aceptar una invitación `org_admin`, desactivar las demás membresías `org_admin` activas de esa organización dentro de la misma transacción, en las dos ramas (usuario existente y usuario nuevo).
- [x] 4.9 Devolver `409` cuando el nombre ya existe y `404` cuando la organización no existe.
- [x] 4.10 Actualizar `docs/api-v1-contract.md` con el nuevo body y la respuesta de `PATCH /api/platform/organizations/:id`.

## 5. Dashboard

- [x] 5.1 Crear `apps/dashboard/src/lib/countries.ts` con `COUNTRIES` y `DEFAULT_COUNTRY = 'Colombia'`.
- [x] 5.2 Agregar Municipio, Departamento y País a Mi Organización después de Dirección; país como select con default Colombia y opción de limpiar.
- [x] 5.3 Agregar los tres campos al formulario de creación de organización de plataforma.
- [x] 5.4 Agregar los tres campos al formulario de creación y edición de comunidad en `AdminPanel`.
- [x] 5.5 Mostrar los tres campos con `DetailField` en el detalle de organización de `/platform`, en el detalle de comunidad y en el resumen de Mi Organización.
- [x] 5.6 Extender el diálogo **Editar** de Organizaciones (ya creado en `polish-admin-workspace`) con el administrador actual y el campo de nuevo administrador.
- [x] 5.7 Precargar el diálogo desde `GET /api/platform/organizations/:id/overview` y mostrar “Administrador pendiente: {email}” cuando corresponda.
- [x] 5.8 Mostrar el `acceptUrl` una sola vez con botón de copiar cuando la transferencia queda pendiente.
- [x] 5.9 Refrescar la fila y el detalle expandido después de guardar, sin cerrar la fila.

## 6. Tests y verificación

- [x] 6.1 Integración: crear organización y comunidad con los tres campos y leerlos de vuelta.
- [x] 6.2 Integración: `PATCH` con `null` limpia los campos y con más de 120 caracteres devuelve `400`.
- [x] 6.3 Integración: transferencia a un email existente deja un solo `org_admin` activo y desactiva al anterior.
- [x] 6.4 Integración: transferencia a un email nuevo crea invitación, mantiene al actual activo y al aceptar deja un solo `org_admin` activo.
- [x] 6.5 Integración: email igual al actual no genera transferencia ni evento.
- [x] 6.6 Integración: `org_admin` y `community_admin` reciben `403` en `PATCH /api/platform/organizations/:id`.
- [x] 6.7 Playwright: el diálogo de edición cambia el nombre y se refleja en la tabla y en el detalle.
- [x] 6.8 Playwright: transferencia a email nuevo muestra “Administrador pendiente” y el link de invitación.
- [x] 6.9 Playwright: el formulario de comunidad guarda y muestra municipio, departamento y país.
- [x] 6.10 `pnpm --filter @porteria/api exec tsc --noEmit`, `pnpm --filter @porteria/dashboard exec tsc --noEmit`, lint, Prettier y `check:theme`.
- [x] 6.11 `pnpm exec openspec validate extend-organization-profile --strict`.
