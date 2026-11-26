# password-reset Specification

## Purpose

Define cómo recupera el acceso una persona que olvidó su contraseña: una
solicitud que no revela si la cuenta existe, un enlace de un solo uso con
vencimiento y un consumo que cambia la contraseña y cierra todas las sesiones.

## Requirements

### Requirement: Request a password reset

Cualquier visitante SHALL poder solicitar un enlace de recuperación indicando un
correo.

#### Scenario: Registered email

- **WHEN** se solicita el reset para un correo con cuenta activa
- **THEN** se emite un token y se envía el correo con el enlace
- **THEN** la respuesta no confirma ni niega la existencia de la cuenta

#### Scenario: Unknown email

- **WHEN** se solicita el reset para un correo sin cuenta
- **THEN** la respuesta es idéntica a la de un correo registrado
- **THEN** no se envía ningún correo

#### Scenario: Inactive account

- **WHEN** se solicita el reset para una cuenta inactiva
- **THEN** la respuesta es idéntica
- **THEN** no se emite token utilizable

### Requirement: Token lifecycle

El token de recuperación SHALL ser de un solo uso, estar hasheado en reposo y
tener vigencia limitada.

#### Scenario: Valid token

- **WHEN** llega un reset con un token vigente y no consumido
- **THEN** el cambio de contraseña se acepta

#### Scenario: Expired token

- **WHEN** el token supera su vigencia
- **THEN** el reset se rechaza con un código estable
- **THEN** el token no puede reutilizarse

#### Scenario: Reuse

- **WHEN** se intenta usar un token ya consumido
- **THEN** el reset se rechaza

#### Scenario: New request invalidates previous

- **WHEN** la misma cuenta solicita un segundo enlace
- **THEN** el token anterior deja de ser válido

### Requirement: Reset outcome

Un reset exitoso SHALL dejar la cuenta con la nueva contraseña, sin sesiones
previas activas y sin cambio obligatorio pendiente.

#### Scenario: Successful reset

- **WHEN** el token es válido y la contraseña cumple la política
- **THEN** la contraseña se actualiza en la fuente única de credenciales
- **THEN** todos los refresh tokens de la cuenta quedan revocados
- **THEN** el token queda marcado como consumido

#### Scenario: Policy violation

- **WHEN** la contraseña nueva no cumple la política
- **THEN** la operación se rechaza
- **THEN** el token permanece disponible hasta su vencimiento

### Requirement: Abuse protection

El endpoint de solicitud SHALL limitar la frecuencia de pedidos.

#### Scenario: Rate limited

- **WHEN** se supera el límite por email o por IP
- **THEN** la respuesta se rechaza sin revelar si la cuenta existe
- **THEN** no se envía un correo adicional

### Requirement: Token confidentiality

El token SHALL viajar sólo en el enlace del correo.

#### Scenario: Logging

- **WHEN** se registra actividad del flujo de recuperación
- **THEN** los logs no contienen el token en claro
