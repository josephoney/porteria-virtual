# resident-workspace Specification

## Purpose
TBD - created by archiving change resident-access-workspace. Update Purpose after archive.
## Requirements
### Requirement: Resident entry into the dashboard

The dashboard SHALL let a user with an active `owner`, `tenant`, or `resident` membership enter a resident workspace instead of being redirected away.

#### Scenario: Login lands on the resident workspace

- **WHEN** a user with an active `resident` membership signs in
- **THEN** the app navigates to `/resident`
- **THEN** `/app-required` is not shown
- **AND** the resident workspace loads without a full page reload

#### Scenario: Owner and tenant share the workspace

- **WHEN** the active membership role is `owner` or `tenant`
- **THEN** the user enters the same `/resident` workspace
- **THEN** the available destinations include the units where the user has an active `location_residents` association

#### Scenario: Role without a surface

- **WHEN** the active membership role has no dedicated surface in the dashboard
- **THEN** the app keeps redirecting to `/app-required`
- **THEN** no resident navigation item is rendered

#### Scenario: Multi-context resident

- **WHEN** a user with several memberships selects a resident context
- **THEN** the resident workspace scopes every screen to the selected community and membership
- **AND** switching context reloads the resident data

### Requirement: Web and mobile channels coexist

The resident workspace SHALL be an additional channel, not a replacement for the mobile app.

#### Scenario: Resident uses both channels

- **WHEN** a resident has used the mobile app before
- **THEN** signing in to the dashboard does not revoke sessions, links, or passes created from the app
- **AND** passes created in either channel appear in the dashboard history

#### Scenario: Dashboard capabilities beyond the app

- **WHEN** the resident opens the dashboard
- **THEN** it offers the authorization history, the bulk upload, and the QR and link actions
- **AND** none of those capabilities require the mobile app

#### Scenario: No forced channel switch

- **WHEN** the resident signs in to the dashboard
- **THEN** the workspace does not instruct the user to install, open, or migrate to the mobile app
- **AND** the entry screen is the workspace itself, not an interstitial

### Requirement: Resident layout

The resident workspace SHALL render its own navigation, separate from the admin sidebar.

#### Scenario: Navigation items

- **WHEN** the resident workspace is rendered
- **THEN** the sidebar contains `Inicio`, `Autorizaciones`, and `Autorizar`
- **THEN** it does not contain `Comunidades`, `Unidades`, `Usuarios`, `Invitaciones`, or `Auditoría`
- **THEN** the header keeps the product logo and the workspace name

#### Scenario: Active section

- **WHEN** the resident navigates to `/resident/authorizations`
- **THEN** only `Autorizaciones` is marked active with `aria-current="page"`

#### Scenario: Admin sidebar untouched

- **WHEN** an `org_admin` or `community_admin` signs in
- **THEN** the admin sidebar renders exactly as before this change
- **AND** the resident navigation is not mounted

### Requirement: Resident home

The resident home SHALL summarize the resident's current authorizations and offer the primary actions.

#### Scenario: Home content

- **WHEN** the resident opens `/resident`
- **THEN** the page shows quick actions `Autorizar visita` and `Autorización masiva`
- **THEN** it lists active authorizations ordered by `valid_until` ascending
- **THEN** each row shows the visitor name, the destination, and until when it is valid

#### Scenario: No authorizations yet

- **WHEN** the resident has no authorizations
- **THEN** the page shows an empty state with the `Autorizar visita` action
- **THEN** it does not show an error

#### Scenario: Feature disabled

- **WHEN** the dynamic QR feature is disabled for the environment
- **THEN** the resident home shows a neutral message that authorizations are not enabled
- **THEN** the create actions are hidden
- **AND** no failed request is surfaced as an application error

### Requirement: Resident data scope

The resident workspace SHALL expose only data the signed-in resident is allowed to see.

#### Scenario: Own authorizations only

- **WHEN** the resident opens the history
- **THEN** the list contains only passes where the resident is the creator or the authorizing person
- **AND** passes from other residents of the same community are not returned

#### Scenario: Own destinations only

- **WHEN** the resident opens the destination selector
- **THEN** the options are limited to the resident's own units and the active destinations of the selected community
- **AND** units and destinations from another community are not offered

#### Scenario: Cross-community attempt

- **WHEN** a resident sends a request with a destination or unit from another community
- **THEN** the API responds with status 404
- **AND** no pass is created

### Requirement: Resident mobile navigation

The resident workspace SHALL be usable on a phone.

#### Scenario: Small viewport

- **WHEN** the resident workspace is rendered at 390x844
- **THEN** the navigation is reachable from a menu control
- **THEN** the history table does not force horizontal scrolling of the whole page
- **AND** the primary action is visible without scrolling past the header

