## Why

La separación de persona y cuenta dejó `users` como capa de compatibilidad
"temporal", pero nunca se retiró. Hoy hay **dos tablas con email y contraseña**
(`users` y `accounts`), el login valida contra una u otra según la rama, y
`changePassword` escribe en ambas a mano. Esa doble escritura ya es frágil con un
solo flujo; los tres flujos de contraseña que vienen (reset por email, seteo por
administrador y cambio obligatorio) la multiplicarían por cuatro.

Además, cambiar la contraseña **no revoca refresh tokens**: una sesión robada
sobrevive al cambio.

## What Changes

- `accounts` pasa a ser la **única fuente de verdad** de credenciales.
- `users` queda como **vista de solo lectura** durante la transición y se elimina
  al final del cambio.
- `refresh_tokens` se vincula a `account_id`; `user_id` se elimina.
- Se centraliza hash, verificación y política de contraseña en un único módulo de
  credenciales; ningún otro punto llama a `bcrypt` directamente.
- Cambiar o resetear una contraseña **revoca todas las sesiones** de esa cuenta.
- Migración con backfill verificado: ninguna fila puede quedar sin credencial
  válida.

## Capabilities

### New Capabilities

- `account-credentials`: fuente única de credenciales, hashing, verificación,
  política y revocación de sesiones.

### Modified Capabilities

- `person-account-model`: `accounts` como único dueño de la contraseña.
- `jwt-auth`: sesiones ligadas a la cuenta, no al usuario legado.

## Impact

- **DB**: `accounts`, `refresh_tokens`, vistas de compatibilidad; migración de
  backfill y limpieza.
- **API**: 33 archivos referencian `users`; auth, users, memberships,
  invitaciones y platform.
- **Shared**: tipos de cuenta/credencial.
- **Dashboard**: listados y perfil.
- **Depende de:** nada.
- **Bloquea a:** `add-password-reset`, `add-admin-password-management`.
