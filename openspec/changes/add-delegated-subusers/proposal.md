## Why

Un residente principal necesita delegar la autorización de visitantes y la gestión de
sus ubicaciones sin crear una cuenta con correo para cada familiar o persona de confianza.
Hoy solo existen usuarios con cuenta y membresías; no hay subusuarios, permisos delegados
ni trazabilidad individual de quién autorizó cada acceso.

## What Changes

- Crear `subuser_delegations`: persona principal ↔ subusuario, relación, modo, estado y
  vigencia.
- Crear `subuser_permissions` y `subuser_locations`: permisos y alcance por ubicación.
- Soportar dos modalidades:
  1. **Subusuario gestionado**: persona sin cuenta; el principal actúa por él y lo
     selecciona como autorizador. No inicia sesión.
  2. **Subusuario con cuenta**: persona con cuenta propia y permisos delegados; inicia
     sesión y opera dentro del alcance.
- Permitir al principal:
  - crear/editar/revocar subusuarios;
  - asignar permisos;
  - permitir que un subusuario autorice visitantes;
  - gestionar sus ubicaciones;
  - ver el historial de autorizaciones.
- Registrar en cada pase quién autorizó: principal, subusuario o ambos.
- **Non-goals:** no se modifica el flujo QR en esta propuesta (7), ni la jerarquía
  administrativa (3), ni la estructura de ubicaciones (4). Depende de persona/cuenta (5).

## Capabilities

### New Capabilities

- `delegated-subusers`: subusuarios gestionados/con cuenta, permisos, alcance,
  revocación y trazabilidad.

### Modified Capabilities

- `membership-rbac`: permisos delegados y autorización de visitantes.
- `user-management`: APIs de subusuarios y delegaciones.

## Impact

- **DB**: `subuser_delegations`, `subuser_permissions`, `subuser_locations`.
- **API**: CRUD de subusuarios, permisos, autorización de pases.
- **Shared**: tipos/DTOs de delegación/permiso.
- **Dashboard/app**: gestión de subusuarios en el modo residente.
- **QR**: el pase agrega `authorized_by_person_id`/`authorized_by_delegation_id` en la
  propuesta 7.
- **Depende de:** `separate-people-and-accounts` y `extend-admin-hierarchy`.
- **Prioridad:** P2, después de 3/5.
