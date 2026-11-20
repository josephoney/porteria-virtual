## Why

Hoy `users` mezcla persona, credenciales y rol. Una misma persona puede terminar
duplicada al asociarse a varias comunidades, y no se puede representar a alguien sin
cuenta (subusuario) ni separar datos personales de credenciales. El correo debe ser el
identificador de la cuenta, no de la persona.

## What Changes

- Crear `people` (persona): nombres, apellidos, tipo/número de documento, teléfono,
  correo de contacto, estado.
- Crear `accounts` (cuenta): `person_id`, email único, password hash, activo,
  `is_platform_admin`, último login.
- Mantener las **asociaciones** (membresías) contra la persona, no contra la cuenta:
  persona ↔ organización/comunidad/ubicación + rol.
- Login por cuenta (email único); el token lleva `accountId` y `personId`.
- Migrar `users` → `people` + `accounts` + memberships, sin perder datos.
- Evitar duplicados: identidad global por documento (tipo+número) y email de cuenta.
- **Non-goals:** no se implementan subusuarios (propuesta 6), ni la jerarquía de
  ubicaciones (4), ni la consola administrativa (3).

## Capabilities

### New Capabilities

- `person-account-model`: persona, cuenta, asociación, login, deduplicación y migración.

### Modified Capabilities

- `user-management`: APIs de personas/cuentas y asociaciones.
- `jwt-auth`: login por cuenta y claims `accountId`/`personId`.

## Impact

- **DB**: `people`, `accounts`; migración de `users`; memberships pasan a `person_id`.
- **API**: auth, users, memberships, invitations, todo lo que hoy usa `userId`.
- **Shared**: tipos/DTOs de persona/cuenta/asociación.
- **Dashboard**: usuarios/membresías; el perfil usa persona + cuenta.
- **Depende de:** nada. Es fundacional y debe ir antes de 3, 4, 6 y 7.
- **Prioridad:** P1.
