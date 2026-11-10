## Why

El change `add-dynamic-qr-access` fue especificado antes de la jerarquía de ubicaciones,
del modelo persona/cuenta y de los subusuarios. La parte de **ubicaciones y personas** ya
fue absorbida por `add-dynamic-qr-access` en el Slice 0 del MVP: el pase usa
`location_unit_id`, `structure_id`, `created_by_person_id` y `authorized_by_person_id`.

Lo que queda pendiente es la parte de **subusuarios/delegaciones** y la resolución de
destinatarios de notificaciones. Eso depende de `add-delegated-subusers` y
`add-notification-service`, ambos fuera del MVP. Este change queda como el puente de
Phase 2 para que esa integración sea aditiva.

## What Changes

- **Parte A (absorbida, ya no se implementa acá):** `location_unit_id`, `structure_id`,
  `created_by_person_id`, `authorized_by_person_id`, validación de hoja y camino de
  ubicación en el scan. Todo eso vive ahora en `add-dynamic-qr-access`.
- **Parte B (Phase 2):**
  - agregar la FK de `authorized_by_delegation_id` cuando exista
    `subuser_delegations`;
  - validar que un subusuario tenga `authorize_visitors` y alcance sobre la ubicación;
  - registrar al subusuario como autorizador en el pase y en la bitácora;
  - resolver destinatarios de notificaciones desde `location_residents` + cuentas,
    incluyendo al autorizador si es distinto del residente principal.
- **Sin migración de datos:** no existen pases en el MVP, así que no hay
  `unit_id` legacy que mapear.
- **Sin alias `unitId`:** el contrato nuevo usa solo `locationUnitId`.
- **Non-goals:** no se redefine el flujo QR, ni el escaneo, ni la app Zima. Es una
  alineación de dependencias e impactos para Phase 2.

## Capabilities

### New Capabilities

- `qr-location-integration`: contrato de integración entre pases QR, subusuarios y
  notificaciones para Phase 2.

### Modified Capabilities

- `add-dynamic-qr-access` ya fue actualizado en sitio con la parte de ubicaciones y
  personas. Este change no lo duplica.

## Impact

- **DB**: FK de `authorized_by_delegation_id` (Phase 2, después de
  `add-delegated-subusers`).
- **API**: creación/validación de pases con delegación, scan y bitácora con autorizador
  subusuario.
- **Shared**: DTOs de pase con autorizador delegado.
- **App Zima**: selector de autorizador para principal/subusuario.
- **Notificaciones**: destinatarios por ubicación y autorizador.
- **Depende de:** `add-delegated-subusers` y `add-notification-service`.
- **Prioridad:** Phase 2, después de esos dos changes.
