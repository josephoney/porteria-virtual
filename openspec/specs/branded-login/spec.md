# branded-login Specification

## Purpose
TBD - created by archiving change polish-dashboard-mvp. Update Purpose after archive.
## Requirements
### Requirement: Two-column branded auth shell

The login and signup screens SHALL render inside a shared auth shell with a brand panel and a form panel.

#### Scenario: Desktop layout

- **WHEN** the viewport is at least 1024px wide
- **THEN** the shell shows a left brand panel of approximately 55% width and a right form panel of approximately 45% width
- **AND** the left panel uses `images/fondo_contacto.png` as a cover background with a theme-aware overlay
- **AND** the right panel contains the auth card with `max-w-md` and is vertically centered

#### Scenario: Mobile layout

- **WHEN** the viewport is narrower than 1024px
- **THEN** the brand panel collapses into a 180–220px hero above the form
- **AND** the form remains fully usable without horizontal scrolling

### Requirement: Brand identity on the auth shell

The auth shell SHALL show the Zima identity on the brand panel.

#### Scenario: Brand copy and logo

- **WHEN** the auth shell is rendered
- **THEN** the left panel shows `LogoZima_W.svg`
- **AND** the heading reads “Zima Seguridad”
- **AND** the supporting text reads “Sistema Portería virtual y accesos”

### Requirement: Login and signup in the same shell

The auth shell SHALL expose login and signup as two states of the same page.

#### Scenario: Switch between login and signup

- **WHEN** the user selects “Iniciar sesión” or “Crear cuenta”
- **THEN** the form panel switches to the corresponding form without leaving the auth shell
- **AND** the active tab is visually indicated

#### Scenario: Signup requires an invitation

- **WHEN** the user opens “Crear cuenta” without an invitation token
- **THEN** the form explains that an invitation is required and shows “Pedí una invitación a tu administrador”
- **AND** the system does not allow open self-registration

#### Scenario: Invitation signup

- **WHEN** the user opens an invitation link and selects “Crear cuenta”
- **THEN** the invitation token is prefilled and the invited email is locked
- **AND** submitting the form uses the existing invitation acceptance flow

### Requirement: Auth shell covers context selection

The context-selection state SHALL keep the same branded shell.

#### Scenario: User with multiple memberships

- **WHEN** login returns `requiresContextSelection`
- **THEN** the right panel shows the membership selector inside the auth card
- **AND** the left brand panel remains visible on desktop

### Requirement: Auth shell uses theme tokens

The auth shell SHALL use the dashboard theme and SHALL NOT introduce raw colors.

#### Scenario: Theme validation

- **WHEN** `check:theme` runs
- **THEN** no raw hex, RGB, or font-family values are added outside `theme.css`
- **AND** the auth shell renders correctly in light and dark modes

