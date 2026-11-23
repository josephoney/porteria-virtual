# account-credentials Specification

## Purpose
Las credenciales de una persona viven en un único lugar: `accounts`. La tabla
legada `users` fue retirada. Este spec cubre dónde se guarda el hash, cómo se
opera con credenciales y qué pasa con las sesiones cuando una contraseña cambia.

## Requirements

### Requirement: Single credential source

El sistema SHALL almacenar la contraseña de una persona únicamente en `accounts`.

#### Scenario: Password stored once

- **WHEN** una cuenta define o cambia su contraseña
- **THEN** el hash se escribe sólo en `accounts.password_hash`
- **THEN** ninguna otra tabla contiene una copia del hash

#### Scenario: No legacy write

- **WHEN** cualquier flujo intenta escribir credenciales en la tabla legada `users`
- **THEN** la escritura falla porque la tabla ya no existe
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

#### Scenario: Historical values preserved

- **WHEN** la tabla `users` se elimina
- **THEN** los identificadores históricos ya se resolvieron a `people` y `accounts`
- **THEN** ningún dato queda dependiendo de la tabla retirada

#### Scenario: Final removal

- **WHEN** el cambio se completa
- **THEN** la tabla `users` no existe
- **THEN** todas las consultas operan sobre `people` y `accounts`
- **THEN** cualquier referencia residual falla de forma explícita

#### Scenario: Unmapped row aborts the migration

- **WHEN** una fila de `users` no tiene una cuenta correspondiente
- **THEN** la migración aborta antes de cualquier cambio destructivo
- **THEN** la base queda intacta
