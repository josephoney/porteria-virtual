## ADDED Requirements

### Requirement: Initial QR

The app SHALL show a rotating QR for the pass.

#### Scenario: Pass detail QR

- **WHEN** the resident opens an active pass
- **THEN** the app shows the QR and refreshes it before the 24-second expiration

#### Scenario: Expired pass

- **WHEN** the pass is used, revoked, or expired
- **THEN** the app shows the final state instead of the QR

### Requirement: Share link

The app SHALL share the pass link with the native share sheet.

#### Scenario: Share

- **WHEN** the resident taps “Compartir”
- **THEN** the app opens the native share sheet with the `/p/:token` link
- **THEN** the resident can send it by WhatsApp, email, or another installed app

#### Scenario: Copy link

- **WHEN** the resident taps “Copiar link”
- **THEN** the link is copied to the clipboard

### Requirement: Pass history

The app SHALL list the resident's passes.

#### Scenario: List

- **WHEN** the resident opens the history
- **THEN** passes are ordered by creation date with visitor, type, status, presence, and
  `locationPath`

#### Scenario: Detail navigation

- **WHEN** the resident taps a pass
- **THEN** the app opens the pass detail

### Requirement: Revoke and regenerate

The app SHALL let the resident revoke a pass or regenerate its link.

#### Scenario: Revoke

- **WHEN** the resident revokes an active pass
- **THEN** the app calls the revoke endpoint and shows the revoked state

#### Scenario: Regenerate for lost phone

- **WHEN** the resident regenerates the link
- **THEN** the app shows the new link and warns that the previous device was unbound

### Requirement: Status updates

The app SHALL reflect entry/exit state.

#### Scenario: Inside

- **WHEN** the pass is inside
- **THEN** the app shows “Dentro” and the entry time

#### Scenario: Used

- **WHEN** the pass is used
- **THEN** the app shows “Usado” and the final time
