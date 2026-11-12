## ADDED Requirements

### Requirement: Neutral dialog surface

Dialogs and floating surfaces SHALL use a neutral surface in the light theme.

#### Scenario: Community dialog

- **WHEN** the create-community dialog opens in the light theme
- **THEN** its surface is a neutral light gray or white
- **THEN** it does not use the previous cream tone

#### Scenario: Structure dialog

- **WHEN** the structure dialog opens in the light theme
- **THEN** its surface matches the neutral surface
- **THEN** its summary block matches the sidebar surface

#### Scenario: Floating surfaces

- **WHEN** a select, dropdown or popover opens in the light theme
- **THEN** it uses the same neutral surface token as the dialogs

#### Scenario: Dark theme

- **WHEN** any of those surfaces opens in the dark theme
- **THEN** it keeps the existing dark surface
- **THEN** text and border contrast remain readable

### Requirement: Token-based surfaces

Surface colors SHALL come from semantic tokens.

#### Scenario: No hardcoded colors

- **WHEN** a dialog or floating surface is rendered
- **THEN** its background comes from a semantic token
- **THEN** no component hardcodes a hex, rgb or oklch value for that surface

#### Scenario: Theme check

- **WHEN** the theme validation runs
- **THEN** it passes with the updated token
