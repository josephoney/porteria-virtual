## ADDED Requirements

### Requirement: Single credential source

El sistema SHALL almacenar la contraseña de una persona únicamente en `accounts`.

#### Scenario: Password stored once

- **WHEN** una cuenta define o cambia su contraseña
- **THEN** el hash se escribe sólo en `accounts.password_hash`
- **THEN** ninguna otra tabla contiene una copia del hash

#### Scenario: No legacy write

- **WHEN** cualquier flujo intenta escribir credenciales en la tabla legada `users`
- **THEN** la escritura falla
- **THEN** el sistema registra el intento como error

### Requirement: Centralized credential operations

El hashing, la verificación y la política de contraseña SHALL ejecutarse en un
único módulo de credenciales.

#### Scenario: Verification

- **WHEN** llega un intento de login con contraseña
- **THEN** la verificación usa el módulo de credenciales
- **THEN** ningún otro punto del código compara hashes directamente

#### Scenario: Policy

- **WHEN** se define una contraseña que no cumple la política
- **THEN** la operación se rechaza con un código estable
- **THEN** el mensaje no revela la contraseña ni el hash

### Requirement: Session revocation on credential change

Cambiar o resetear una contraseña SHALL revocar todas las sesiones activas de esa
cuenta.

#### Scenario: Change revokes sessions

- **WHEN** una cuenta cambia su contraseña
- **THEN** todos sus refresh tokens quedan revocados
- **THEN** un refresh posterior responde no autorizado

#### Scenario: Other accounts unaffected

- **WHEN** una cuenta cambia su contraseña
- **THEN** las sesiones de las demás cuentas permanecen activas

### Requirement: Sessions belong to accounts

Los refresh tokens SHALL identificarse por cuenta.

#### Scenario: Token issued

- **WHEN** una cuenta inicia sesión
- **THEN** el refresh token queda asociado a `account_id`
- **THEN** el token no depende de la tabla legada `users`

### Requirement: Legacy table retired

La tabla `users` SHALL dejar de existir como fuente de identidad o credencial.

#### Scenario: Read compatibility

- **WHEN** el retiro está en curso
- **THEN** `users` expone una vista de solo lectura equivalente
- **THEN** las consultas existentes siguen respondiendo

#### Scenario: Final removal

- **WHEN** el cambio se completa
- **THEN** la vista `users` se elimina
- **THEN** todas las consultas operan sobre `people` y `accounts`
