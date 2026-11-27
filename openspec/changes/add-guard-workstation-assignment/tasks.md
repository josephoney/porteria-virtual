## 1. Tipos compartidos

- [x] 1.1 Crear `packages/shared/src/types/workstation.ts` con `WorkstationAssignment`, `WorkstationAssignmentResult` y `AccessPointGuard`.
- [x] 1.2 Crear `packages/shared/src/dto/workstation.ts` con `AssignWorkstationDto` (`accessPointId: string | null`).
- [x] 1.3 Exportar tipos y DTO desde `packages/shared/src/index.ts` y verificar que compila.

## 2. Servicio de puestos

- [x] 2.1 Crear `server/api/src/services/workstation.service.ts` con `assignWorkstation(membershipId, accessPointId, requester)` y `getWorkstationForAccount(accountId)`.
- [x] 2.2 Rechazar roles distintos de `guard` con `400 role_not_guard` (incluye `staff`, `operator` y administradores).
- [x] 2.3 Rechazar una membresÃ­a sin `communityId` con `400 membership_requires_community`.
- [x] 2.4 Resolver el acceso dentro de la comunidad de la membresÃ­a: fuera de la comunidad â†’ `404`; inactivo â†’ `400 access_point_inactive`.
- [x] 2.5 Aplicar alcance del actor: `org_admin` su organizaciÃ³n, `community_admin` solo su comunidad; platform admin y roles sin permiso de gestiÃ³n â†’ `403` (tenant read-only).
- [x] 2.6 Implementar desasignaciÃ³n con `accessPointId = null`, idempotente y sin evento cuando no hay cambio.
- [x] 2.7 Devolver `appliesNextShift` y `activeShiftAccessPointId` leyendo el turno abierto y su segmento actual.
- [x] 2.8 Registrar `admin.workstation.assigned` / `admin.workstation.unassigned` con membership, persona, comunidad, acceso anterior y nuevo.
- [x] 2.9 Hacer que `memberships.service.updateMembership` delegue en este servicio cuando llegue `defaultAccessPointId`, sin duplicar validaciones.
- [x] 2.10 Tests unitarios de las reglas: rol, comunidad, acceso inactivo, alcance, desasignaciÃ³n idempotente y turno abierto.

## 3. Rutas y esquemas

- [x] 3.1 Agregar `assignWorkstationSchema` en `server/api/src/schemas/index.ts` con `accessPointId` uuid nullable.
- [x] 3.2 Implementar `PUT /api/memberships/:id/workstation` con `requireRole('org_admin', 'community_admin')`.
- [x] 3.3 Mapear los cÃ³digos de error a `400`/`403`/`404` incluyendo `code` estable en el cuerpo.
- [x] 3.4 Implementar `GET /api/me/workstation` para cualquier autenticado, con `accessPointId = null` para quien no es guardia.
- [x] 3.5 Registrar las rutas nuevas en `server/api/src/index.ts` si el mÃ³dulo es independiente.

## 4. Lecturas de asignaciÃ³n

- [x] 4.1 Implementar `GET /api/communities/:id/access-points/:accessPointId/guards` con guardias asignados, `onShift` y `shiftId`.
- [x] 4.2 Agregar `assignedGuards` al listado de accesos con una sola consulta agregada.
- [x] 4.3 Aplicar alcance por comunidad y organizaciÃ³n en ambos endpoints.
- [x] 4.4 Ordenar los guardias por nombre y excluir membresÃ­as inactivas.

## 5. Dashboard: Usuarios

- [x] 5.1 Crear `apps/dashboard/src/components/admin/WorkstationDialog.tsx` con selector de accesos activos y opciÃ³n "Sin asignar".
- [x] 5.2 Cargar los accesos de la comunidad de la membresÃ­a, con cachÃ© por comunidad.
- [x] 5.3 Agregar la acciÃ³n de fila "Puesto de trabajo" solo en membresÃ­as `guard` que el actor pueda asignar.
- [x] 5.4 Guardar con `PUT /api/memberships/:id/workstation` y reflejar el cambio sin recargar la pÃ¡gina.
- [x] 5.5 Mostrar `role_not_guard`, `access_point_inactive` y errores de alcance con mensajes claros.
- [x] 5.6 Avisar cuando el guardia tiene turno abierto e indicar que el cambio aplica al siguiente turno.
- [x] 5.7 Estado vacÃ­o cuando la comunidad no tiene accesos activos, con enlace a Accesos.
- [x] 5.8 Etiquetar la acciÃ³n como "Puesto por defecto" y evitar cualquier texto que sugiera que restringe el turno.

## 6. Dashboard: Accesos

- [x] 6.1 Agregar la columna "Guardias" con el valor `assignedGuards`.
- [x] 6.2 Mostrar el detalle de guardias asignados, distinguiendo quiÃ©n estÃ¡ en turno.
- [x] 6.3 Agregar la acciÃ³n "Asignar" que abre el diÃ¡logo con el acceso preseleccionado.
- [x] 6.4 Mostrar el conteo en accesos inactivos sin ofrecer el acceso en el selector.

## 7. Dashboard: panel del guardia

- [x] 7.1 Leer el puesto desde `GET /api/me/workstation` al montar el panel y tras iniciar o cerrar turno.
- [x] 7.2 Mostrar el puesto asignado con nombre, tipo y direcciÃ³n.
- [x] 7.3 Mostrar "Sin puesto asignado" con indicaciÃ³n de pedir asignaciÃ³n a un administrador.
- [x] 7.4 Avisar cuando el puesto asignado estÃ¡ inactivo y permitir elegir otro acceso al iniciar turno.

## 8. Pruebas y verificaciÃ³n

- [x] 8.1 IntegraciÃ³n: asignar, reasignar, desasignar y leer el puesto propio.
- [x] 8.2 IntegraciÃ³n: matriz de restricciones (rol, sin comunidad, otra comunidad, inactivo, fuera de alcance, platform admin, guardia).
- [x] 8.3 IntegraciÃ³n: cambiar el puesto con turno abierto no mueve el segmento ni escribe bitÃ¡cora.
- [x] 8.4 IntegraciÃ³n: listado de guardias por acceso y `assignedGuards` en el listado de accesos.
- [x] 8.5 IntegraciÃ³n: desactivar el acceso conserva la asignaciÃ³n y el guardia puede elegir otro.
- [x] 8.6 IntegraciÃ³n: `PATCH /api/memberships/:id` con `defaultAccessPointId` registra los mismos eventos.
- [x] 8.7 E2E: el admin asigna el puesto desde Usuarios y el guardia lo ve en `/guard`.
- [x] 8.8 Ejecutar `pnpm --filter @porteria/api test` y `test:integration`.
- [x] 8.9 Ejecutar `npx eslint src/` en `apps/dashboard` y `server/api` sin errores nuevos.
- [x] 8.10 IntegraciÃ³n: un guardia inicia turno en un acceso distinto al asignado; el turno arranca ahÃ­ y la asignaciÃ³n no cambia.

## 9. DocumentaciÃ³n

- [x] 9.1 Corregir `docs/onboarding-comunidad.md` para describir la acciÃ³n real en lugar del campo inexistente.
- [x] 9.2 Actualizar la matriz de `docs/roles-y-permisos.md` con la capacidad "Puesto de trabajo".
- [x] 9.3 Agregar los endpoints a `docs/api-v1-contract.md`.

## 10. Cierre

- [x] 10.1 Ejecutar `openspec validate add-guard-workstation-assignment --strict`.
- [x] 10.2 Confirmar que no hace falta migraciÃ³n ni paso de runbook, y dejarlo escrito en el cambio.

## Notas de cierre

- **Sin migración**: el cambio usa `memberships.default_access_point_id`, que ya existe con su índice. No requiere paso de runbook ni dump previo.
- **E2E**: `tests/workstation.spec.ts` cubre el recorrido admin → `/guard` (asignar y limpiar).
- **Verificado**: `pnpm --filter @porteria/api test` (56/56), `test/workstation.integration.test.ts` (8/8), `eslint` en API y en los archivos tocados del dashboard, `tsc` del API sin errores.
