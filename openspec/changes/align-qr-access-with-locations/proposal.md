## Why

El change `add-dynamic-qr-access` (activo, 0/94 tareas) usa `unitId` fijo y `created_by`
como usuario. Las propuestas 3–6 introducen jerarquía configurable de ubicaciones,
personas/cuentas y subusuarios. Si el QR se implementa sin alinearlo, queda con
referencias incompatibles y sin trazabilidad de subusuarios.

## What Changes

- Reemplazar la referencia `access_passes.unit_id` por `location_unit_id` (nodo hoja de
  la estructura de ubicaciones).
- Agregar `structure_id`/ubicación denormalizada para reportes y filtros.
- Registrar el autorizador:
  - `created_by_person_id`;
  - `authorized_by_person_id`;
  - `authorized_by_delegation_id` (si autorizó un subusuario).
- Validar al crear el pase:
  - que la ubicación sea hoja y pertenezca a la comunidad;
  - que el creador sea el principal de la ubicación o un subusuario con
    `authorize_visitors` y alcance;
  - que la comunidad/ubicación estén dentro del tenant.
- Escanear/bitácora: mostrar la ruta de ubicación (estructura + unidad) y el autorizador
  (principal/subusuario).
- Notificaciones: resolver destinatarios desde `location_residents` y cuentas; mantener
  al guardia/admin en salidas faltantes.
- Migrar pases existentes de `unit_id` → `location_unit_id`.
- Actualizar el change activo `add-dynamic-qr-access` (no duplicarlo): proposal, design,
  specs y tasks.
- **Non-goals:** no se redefine el flujo QR, ni el escaneo, ni la app Zima. Es una
  alineación de dependencias e impactos.

## Capabilities

### New Capabilities

- `qr-location-integration`: contrato de integración entre pases QR, ubicaciones, personas
  y subusuarios.

### Modified Capabilities

- El change activo `add-dynamic-qr-access` se actualiza en sitio. No se crea un QR
  paralelo.

## Impact

- **DB**: `access_passes` columns/FKs; migración de `unit_id`.
- **API**: creación/validación de pases, escaneo, bitácora, notificaciones.
- **Shared**: DTOs de pase con ubicación/autorizador.
- **App Zima**: selector de ubicación y autorizador.
- **Notificaciones**: destinatarios por ubicación.
- **Depende de:** `extend-admin-hierarchy`, `add-configurable-location-hierarchy`,
  `separate-people-and-accounts`, `add-delegated-subusers`.
- **Prioridad:** P1, después de 3–6 y antes de implementar el QR.
