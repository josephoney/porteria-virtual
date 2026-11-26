## 1. Base de datos

- [ ] 1.1 Crear `packages/database/src/schema/invitation-units.ts` con `invitationId`, `locationUnitId`, `createdAt`, PK compuesta y FKs con `on delete cascade`.
- [ ] 1.2 Exportar `invitationUnits` y sus tipos desde el índice de schema.
- [ ] 1.3 Agregar migración `0039_invitation_units.sql`: tabla puente, backfill desde `invitations.location_unit_id`, índice único parcial `memberships_person_location_unit_idx` y `invitations_pending_unit_idx`.
- [ ] 1.4 Verificar que la migración sea idempotente (`on conflict do nothing`, `if not exists`) y que corra sobre una base con invitaciones existentes.
- [ ] 1.5 Extender `schema-migration.integration.test.ts` para comprobar tabla, índices y backfill.

## 2. Servicio de invitaciones

- [ ] 2.1 Agregar `locationUnitIds` a `CreateInvitationInput` y resolver la lista (con fallback a `locationUnitId`/`unitId`).
- [ ] 2.2 Validar que cada unidad exista, sea hoja y pertenezca a la comunidad resuelta; devolver `400 unit_invalid` con el id en el primer fallo.
- [ ] 2.3 Rechazar más de 50 unidades por invitación (`400 too_many_units`).
- [ ] 2.4 Insertar la invitación y sus filas de `invitation_units` en una transacción.
- [ ] 2.5 Corregir `findMembership` para aceptar `locationUnitId` y filtrar por esa columna cuando venga.
- [ ] 2.6 Usar la variante corregida en la detección de duplicados de `createInvitation` (mismo email + misma unidad + rol).
- [ ] 2.7 En `acceptInvitation`, leer las unidades del puente (fallback a `location_unit_id`) y crear una membresía por unidad con `onConflictDoNothing`.
- [ ] 2.8 Crear un registro en `location_residents` por unidad aceptada (`validFrom` = hoy, `relationship` derivada del rol, `status` active, `onConflictDoNothing`).
- [ ] 2.9 Devolver `409 already_member` solo si todas las membresías ya existían; si no, informar `membershipsCreated`.
- [ ] 2.10 Devolver la membresía de la unidad primaria como contexto activo, para que `switchContext` no elija otra.
- [ ] 2.11 Extender `previewInvitation` y `listInvitations` para devolver `units: [{ id, code, path }]`.

## 3. API y esquemas

- [ ] 3.1 Extender `createInvitationSchema` con `locationUnitIds` (array de uuid, 1..50) sin romper `locationUnitId`.
- [ ] 3.2 Extender `acceptInvitationSchema` con `phone?` y `documentNumber?` opcionales y persistirlos en `people`.
- [ ] 3.3 Crear `bulkInvitationRowSchema` (unit, email, name?) y `bulkInvitationsSchema` con máximo 500 filas.
- [ ] 3.4 Implementar `POST /api/invitations/bulk/preview` con permisos `org_admin`/`community_admin` (y plataforma) y alcance por fila.
- [ ] 3.5 Implementar `POST /api/invitations/bulk` con resultado parcial por fila y resumen.
- [ ] 3.6 Mapear errores de dominio a códigos estables (`unit_invalid`, `unit_ambiguous`, `already_member`, `forbidden`, `invalid_email`, `duplicate_row`).
- [ ] 3.7 Verificar que `community_admin` no pueda invitar fuera de su comunidad ni con roles operativos en este flujo.

## 4. Parser CSV compartido

- [ ] 4.1 Extraer de `ResidentAuthorizationBulkPage` la detección de delimitador, el split con comillas, el BOM/CRLF y la normalización de encabezados a `src/lib/csv.ts`.
- [ ] 4.2 Refactorizar `ResidentAuthorizationBulkPage` para usar el módulo sin cambiar su comportamiento.
- [ ] 4.3 Agregar tests unitarios del parser (coma, punto y coma, comillas, BOM, saltos CRLF, encabezados con acentos).
- [ ] 4.4 Implementar la resolución de unidad por `code` y por path (`Nivel > Nivel > Unidad`) con error de ambigüedad y candidatos.

## 5. Diálogo de invitación

- [ ] 5.1 Crear `components/admin/ResidentInviteDialog.tsx` con correo, rol (resident por defecto) y lista de unidades removibles.
- [ ] 5.2 Validar el correo con `emailError` y el mínimo de una unidad; mostrar errores inline con `fieldA11y`.
- [ ] 5.3 Enviar `locationUnitIds` a `POST /api/invitations` y mostrar pending en el botón.
- [ ] 5.4 En éxito, mostrar el link una sola vez, el estado del correo (`emailSent`) y un botón de copiar.
- [ ] 5.5 Cubrir el error `already_member` con un mensaje que indique la unidad conflictiva.

## 6. Unidades y árbol

- [ ] 6.1 En `UnitsPage`, agregar columna de acciones con `Invitar residente` solo en hojas y solo con permiso.
- [ ] 6.2 Agregar selección múltiple (checkbox por fila) y barra flotante “Invitar a N unidades”.
- [ ] 6.3 Agregar `Carga masiva` junto a los filtros, visible solo con permiso.
- [ ] 6.4 En `LocationTreeTable`, agregar `Invitar residente` al menú de acciones de hojas.
- [ ] 6.5 Agregar selección múltiple en el árbol y reutilizar la barra y el diálogo.
- [ ] 6.6 Deshabilitar la acción cuando la unidad no es hoja, está archivada o no admite ocupantes.

## 7. Panel de invitaciones y carga masiva

- [ ] 7.1 Mostrar en `AdminPanel` y `PlatformPage` las unidades de cada invitación pendiente como chips.
- [ ] 7.2 Crear `components/admin/BulkInvitationsDialog.tsx` con carga de archivo, pegado de texto y descarga de plantilla.
- [ ] 7.3 Implementar preview contra `/api/invitations/bulk/preview` con tabla de filas válidas/inválidas y conteos.
- [ ] 7.4 Implementar el envío contra `/api/invitations/bulk` con resultado por fila y opción de reintentar las fallidas.
- [ ] 7.5 Bloquear el envío si no hay filas válidas o si se superan 500 filas.

## 8. Página de aceptación

- [ ] 8.1 Mostrar en `InvitePage` todas las unidades de la invitación.
- [ ] 8.2 Agregar teléfono y documento opcionales al formulario de cuenta nueva, con validación inline.
- [ ] 8.3 Enviar `phone` y `documentNumber` en el accept y refrescar el perfil al entrar.
- [ ] 8.4 Mantener el camino de cuenta existente (login requerido, 403 por email distinto) sin cambios.

## 9. Pruebas y verificación

- [ ] 9.1 Integración: invitación multi-unidad crea filas en el puente y devuelve las unidades.
- [ ] 9.2 Integración: duplicado por unidad responde 409 y no inserta una segunda invitación.
- [ ] 9.3 Integración: aceptar crea N membresías y N `location_residents`.
- [ ] 9.4 Integración: aceptar con todas las membresías existentes responde 409 sin duplicar residentes.
- [ ] 9.5 Integración: lote con filas válidas, inválidas y duplicadas devuelve el resumen correcto y crea solo las válidas.
- [ ] 9.6 Integración: `community_admin` no puede invitar a una unidad de otra comunidad.
- [ ] 9.7 Ejecutar `pnpm --filter @porteria/api test` y `test:integration`.
- [ ] 9.8 Ejecutar `npx eslint src/` en `apps/dashboard` y `apps/api` sin errores nuevos.
- [ ] 9.9 Verificar en staging: invitar desde la fila, desde el árbol y por CSV; aceptar y comprobar membresías, panel de residentes y acceso.

## 10. Documentación

- [ ] 10.1 Actualizar `docs/design-system.md` solo si se agrega un primitivo nuevo (chip de unidad, barra de selección).
- [ ] 10.2 Documentar el formato CSV y sus límites en `docs/` junto al flujo de invitaciones.
- [ ] 10.3 Actualizar `docs/runbook-produccion.md` si el deploy requiere correr la migración 0039.
