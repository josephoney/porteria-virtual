## ADDED Requirements

### Requirement: Administrative password reset

Un administrador autorizado SHALL poder restablecer la contraseña de una cuenta
dentro de su alcance.

#### Scenario: Organization admin resets a community admin

- **WHEN** un `org_admin` restablece la contraseña de un `community_admin` de su
  organización
- **THEN** la operación se acepta
- **THEN** se registra un evento de auditoría con actor y objetivo

#### Scenario: Organization admin resets a guard

- **WHEN** un `org_admin` restablece la contraseña de un `guard` de su
  organización
- **THEN** la operación se acepta

#### Scenario: Community admin resets a resident

- **WHEN** un `community_admin` restablece la contraseña de un residente de su
  comunidad
- **THEN** la operación se acepta

#### Scenario: Community admin resets a guard

- **WHEN** un `community_admin` intenta restablecer la contraseña de un `guard`
- **THEN** la operación se rechaza con 403

### Requirement: Scope enforcement

El sistema SHALL impedir el reseteo fuera del alcance del actor.

#### Scenario: Peer escalation

- **WHEN** un administrador intenta restablecer la contraseña de otro
  administrador del mismo nivel
- **THEN** la operación se rechaza con 403

#### Scenario: Cross organization

- **WHEN** el objetivo pertenece a otra organización
- **THEN** la operación se rechaza con 403
- **THEN** el mensaje no revela datos del objetivo

#### Scenario: Platform admin target

- **WHEN** el objetivo es un `platform_admin`
- **THEN** la operación se rechaza con 403

### Requirement: Reset modes

El reseteo SHALL ofrecer definición directa o envío de enlace.

#### Scenario: Direct definition

- **WHEN** el administrador define la contraseña
- **THEN** la contraseña se valida contra la política
- **THEN** el valor se devuelve una única vez

#### Scenario: Link delivery

- **WHEN** el administrador elige enviar el enlace
- **THEN** se emite un token de recuperación y se envía el correo
- **THEN** el administrador no recibe la contraseña

### Requirement: Mandatory password change

El sistema SHALL poder exigir el cambio de contraseña en el próximo ingreso.

#### Scenario: Temporary password

- **WHEN** el reseteo se marca como temporal
- **THEN** la cuenta queda con cambio obligatorio pendiente
- **THEN** el login sólo habilita la pantalla de cambio de contraseña

#### Scenario: Clearing the flag

- **WHEN** la cuenta cambia la contraseña
- **THEN** el cambio obligatorio se limpia
- **THEN** el acceso completo se restablece

#### Scenario: Definitive password

- **WHEN** el reseteo no se marca como temporal
- **THEN** la cuenta accede normalmente con la contraseña definida

### Requirement: Session revocation on administrative reset

Un reseteo administrativo SHALL revocar las sesiones activas de la cuenta
objetivo.

#### Scenario: Existing session invalidated

- **WHEN** el administrador restablece una contraseña
- **THEN** todos los refresh tokens del objetivo quedan revocados

### Requirement: Auditable resets

Toda acción de reseteo SHALL quedar registrada.

#### Scenario: Audit record

- **WHEN** se ejecuta un reseteo
- **THEN** el evento incluye actor, objetivo, método y resultado
- **THEN** el evento no incluye la contraseña ni el token
