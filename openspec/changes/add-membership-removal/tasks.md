## 1. API: borrado de membresÃ­a

- [x] 1.1 Agregar `deleteMembership(id, requester)` en `memberships.service.ts` con `{ deleted: true } | { error } | { notFound }`.
- [x] 1.2 Rechazar al platform admin con `tenant_read_only`.
- [x] 1.3 Validar alcance por organizaciÃ³n y comunidad; fuera de alcance â†’ `not_found`.
- [x] 1.4 Aplicar la polÃ­tica de rol: no se puede borrar un rol que el actor no puede asignar.
- [x] 1.5 Rechazar el borrado de la Ãºltima membresÃ­a `org_admin` activa de la organizaciÃ³n (`409 last_org_admin`).
- [x] 1.6 Rechazar el borrado de la propia membresÃ­a del contexto activo (`409 own_active_membership`).
- [x] 1.7 Rechazar el borrado si la persona tiene un turno abierto en esa comunidad (`409 open_shift`).
- [x] 1.8 Registrar `membership.deleted` con persona, rol, comunidad y estado previo.

## 2. API: ruta y errores

- [x] 2.1 Implementar `DELETE /api/memberships/:id` con `requireRole('org_admin', 'community_admin')`.
- [x] 2.2 Mapear cÃ³digos a `403`/`404`/`409` incluyendo `code` estable en el cuerpo.
- [x] 2.3 Extender `Requester` con `membershipId` para detectar el contexto propio.

## 3. Dashboard: columna Acciones

- [x] 3.1 Agregar la columna "Acciones" despuÃ©s de MembresÃ­a y ajustar el `colSpan` de los estados vacÃ­os.
- [x] 3.2 Mover los iconos de la celda de MembresÃ­a a la nueva columna.
- [x] 3.3 Alinear los iconos en una sola fila horizontal, en orden fijo, conservando `title` y `aria-label`.
- [x] 3.4 Rotular la baja lÃ³gica como "Inactivar asignaciÃ³n" / "Reactivar asignaciÃ³n".

## 4. Dashboard: eliminar asignaciÃ³n

- [x] 4.1 Agregar la acciÃ³n "Eliminar asignaciÃ³n" solo para roles que el actor pueda asignar.
- [x] 4.2 Confirmar con persona, rol y comunidad antes de borrar.
- [x] 4.3 Llamar `DELETE /api/memberships/:id`, refrescar la tabla y mostrar el error del API cuando falle (turno abierto, Ãºltima organizaciÃ³n, contexto propio).
- [x] 4.4 Estado vacÃ­o y manejo de errores sin romper la tabla.

## 5. Pruebas

- [x] 5.1 IntegraciÃ³n: borrar una membresÃ­a inactiva y una activa; el usuario y su historial siguen.
- [x] 5.2 IntegraciÃ³n: `last_org_admin`, `own_active_membership` y `open_shift` responden `409` con su cÃ³digo.
- [x] 5.3 IntegraciÃ³n: `community_admin` no borra un `org_admin` (`403`) y fuera de alcance es `404`.
- [x] 5.4 IntegraciÃ³n: platform admin `403` y la membresÃ­a permanece.
- [x] 5.5 Ejecutar `pnpm --filter @porteria/api test` y `test:integration`.

## 6. DocumentaciÃ³n y cierre

- [x] 6.1 Agregar `DELETE /api/memberships/:id` a `docs/api-v1-contract.md`.
- [x] 6.2 Anotar en `docs/roles-y-permisos.md` que eliminar sigue la polÃ­tica de asignaciÃ³n.
- [x] 6.3 `eslint` en API y dashboard, `tsc` del API y `openspec validate --strict`.
