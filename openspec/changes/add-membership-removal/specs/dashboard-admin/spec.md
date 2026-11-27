## ADDED Requirements

### Requirement: Membership actions column

The users table SHALL present the membership actions in their own column, after the
membership column.

#### Scenario: Column order

- **WHEN** an admin opens `/admin/users`
- **THEN** the columns are Cuenta, Persona, Documento, Comunidad, Membresía, Acciones and
  Estado
- **THEN** the Membresía cell shows only the role selector and its badges

#### Scenario: Vertical order of the actions

- **WHEN** the actions are rendered for a membership
- **THEN** the icons are stacked vertically in a fixed order: agregar asignación, cambiar
  contraseña, reenviar activación, puesto por defecto (guards only), inactivar o
  reactivar, and eliminar asignación last
- **THEN** each icon keeps its accessible name

#### Scenario: Delete action

- **WHEN** the admin chooses "Eliminar asignación"
- **THEN** a confirmation dialog shows the person, the role and the community
- **THEN** confirming calls `DELETE /api/memberships/:id`
- **THEN** the row disappears and the table refreshes

#### Scenario: Delete is not offered for foreign roles

- **WHEN** the actor cannot assign the membership role
- **THEN** the delete action is not rendered for that row

#### Scenario: Distinguish deactivate from delete

- **WHEN** the membership is active
- **THEN** the action is labelled "Inactivar asignación"
- **WHEN** the membership is inactive
- **THEN** the same action is labelled "Reactivar asignación"
- **THEN** "Eliminar asignación" is always a separate, destructive action
