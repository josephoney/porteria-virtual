## Why

Desde el administrador de organización no hay forma de editar la información de
los administradores de comunidad ni de restablecer contraseñas. Si alguien
olvidó la suya, la cuenta queda bloqueada: el autoservicio no existe y el
administrador no tiene herramienta. Tampoco existe la noción de «cambiar la
contraseña en el próximo ingreso», así que una contraseña temporal no puede
forzar su reemplazo.

Este cambio da al administrador una salida controlada, auditable y con alcance
acotado, sin que pueda escalar privilegios.

## What Changes

- Nueva columna `accounts.must_change_password`.
- `POST /api/accounts/:id/password` con dos modos: `direct` (el administrador
  define la contraseña) y `link` (se envía el enlace de recuperación).
- Matriz de alcance aplicada en el servidor: el rol determina a quién puede
  resetear.
- Al resetear se revocan todas las sesiones de la cuenta objetivo.
- Evento de auditoría con actor, objetivo, método y resultado.
- El login exige cambiar la contraseña mientras `must_change_password` esté
  activo.
- Acción «Cambiar contraseña» en el listado de usuarios del dashboard.

## Capabilities

### New Capabilities

- `admin-password-management`: alcance, modos de reseteo, contraseña temporal y
  auditoría.

### Modified Capabilities

- `user-management`: acción administrativa sobre cuentas.
- `membership-rbac`: matriz de alcance para reseteo.
- `jwt-auth`: bloqueo por cambio obligatorio pendiente.

## Impact

- **DB**: `accounts.must_change_password`.
- **API**: endpoint administrativo, gate en login/refresh, auditoría.
- **Shared**: DTOs de reseteo y estado de contraseña.
- **Dashboard**: acción y diálogo en el listado de usuarios.
- **Depende de:** `unify-account-credentials`, `add-password-reset`.
