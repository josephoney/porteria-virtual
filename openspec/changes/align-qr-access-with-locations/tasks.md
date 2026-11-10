## 1. Parte A absorbida por `add-dynamic-qr-access`

- [x] 1.1 Proposal del QR actualizado con `locationUnitId`, persona y autorizador
- [x] 1.2 Design del QR actualizado con validación de hoja y camino de ubicación
- [x] 1.3 Spec `dynamic-pass-creation` actualizada (`locationUnitId`, autorizador)
- [x] 1.4 Spec `pass-scan-entry` actualizada (camino de ubicación, autorizador)
- [x] 1.5 Spec `database-schema` actualizada (columnas/FKs de ubicación y persona)
- [x] 1.6 Spec `shared-types` actualizada (DTOs con `locationPath`)
- [x] 1.7 Tasks del QR actualizadas con las tareas de ubicación y autorizador
- [x] 1.8 Sin migración de datos: no existen pases legacy en el MVP
- [x] 1.9 Sin alias `unitId`: el contrato usa solo `locationUnitId`

## 2. Phase 2: dependencias

- [ ] 2.1 Implementar `add-delegated-subusers` (tablas, permisos, `/api/me/subusers`)
- [ ] 2.2 Implementar `add-notification-service` (templates, worker, push)
- [ ] 2.3 Agregar la FK de `authorized_by_delegation_id` a `subuser_delegations`

## 3. Phase 2: API de creación

- [ ] 3.1 Validar delegación activa y `authorize_visitors` al crear el pase
- [ ] 3.2 Validar el alcance de la delegación sobre `location_unit_id`
- [ ] 3.3 Guardar `authorized_by_delegation_id` cuando corresponda
- [ ] 3.4 Rechazar subusuarios sin permiso con 403
- [ ] 3.5 Mantener el autorizador principal cuando no hay delegación

## 4. Phase 2: scan y bitácora

- [ ] 4.1 Devolver el autorizador delegado y su relación en el scan
- [ ] 4.2 Persistir `authorized_by_delegation_id` en el snapshot de bitácora
- [ ] 4.3 Mostrar el camino de ubicación y el autorizador en el historial

## 5. Phase 2: notificaciones

- [ ] 5.1 Resolver destinatarios desde `location_residents` + accounts
- [ ] 5.2 Notificar al autorizador si es distinto del residente principal
- [ ] 5.3 Mantener guardia/`community_admin` para salida faltante
- [ ] 5.4 Incluir ubicación/estructura en el payload de notificación

## 6. Phase 2: app Zima

- [ ] 6.1 Selector de autorizador para principal/subusuario
- [ ] 6.2 Mostrar el camino de ubicación y el autorizador en el detalle
- [ ] 6.3 Ocultar el selector de subusuario si no hay delegaciones activas

## 7. Verificación Phase 2

- [ ] 7.1 El residente principal crea un pase para una ubicación hoja
- [ ] 7.2 Un subusuario con permiso crea un pase; la trazabilidad es correcta
- [ ] 7.3 Un subusuario sin permiso es rechazado con 403
- [ ] 7.4 Ubicación no hoja o cross-tenant rechazada
- [ ] 7.5 El scan muestra camino de ubicación y autorizador delegado
- [ ] 7.6 Las notificaciones llegan a los residentes correctos
- [ ] 7.7 Regresión del flujo QR del MVP
- [ ] 7.8 `pnpm lint` y `tsc --noEmit` pasan
