# workspace-context Specification

## Purpose
TBD - created by archiving change polish-admin-workspace. Update Purpose after archive.
## Requirements
### Requirement: Workspace identity in the shell

The dashboard shell MUST show the active workspace name and logo instead of a fixed product name.

#### Scenario: Organization administrator

- **WHEN** the active role is `org_admin`
- **THEN** the sidebar header shows the organization name
- **THEN** the sidebar header shows the organization logo when one exists

#### Scenario: Community-scoped role

- **WHEN** the active role is `community_admin`, `operator` or `guard`
- **THEN** the sidebar header shows the community name
- **THEN** the sidebar header shows the community logo when one exists

#### Scenario: Platform administrator

- **WHEN** the user is a platform administrator without a tenant membership
- **THEN** the sidebar header shows “Portería Virtual” and the platform icon

#### Scenario: Missing logo

- **WHEN** the active workspace has no `logoAssetId`
- **THEN** a building fallback icon is shown instead of an image

#### Scenario: Long name

- **WHEN** the workspace name does not fit the header
- **THEN** the name is truncated with an ellipsis
- **THEN** the full name is exposed through the `title` attribute

#### Scenario: Context change

- **WHEN** the user switches membership or logs out
- **THEN** the workspace name and logo are re-resolved for the new context

### Requirement: Welcome toast on dashboard entry

The dashboard MUST greet the user with a centered top toast that names the active workspace and MUST remove it automatically after about five seconds. Landing and summary pages MUST NOT render a fixed welcome block.

#### Scenario: First entry in the session

- **WHEN** an authenticated user enters the dashboard for the first time in the browser session
- **THEN** a toast appears centered at the top of the viewport with “Bienvenido, {user.name}”
- **THEN** the toast also names the organization, the community or “Plataforma” depending on the active workspace

#### Scenario: Auto dismiss

- **WHEN** five seconds pass without interaction
- **THEN** the toast fades out and is removed from the DOM

#### Scenario: No repetition

- **WHEN** the user navigates between dashboard routes, or reloads the page in the same browser session
- **THEN** the toast is not shown again for that workspace

#### Scenario: Context switch

- **WHEN** the user switches membership to another organization or community
- **THEN** the toast is shown once for the new workspace

#### Scenario: Missing display name

- **WHEN** the authenticated user has no `name`
- **THEN** the greeting falls back to the user email

#### Scenario: Toast does not block the UI

- **WHEN** the toast is visible
- **THEN** clicks pass through it to the page underneath

#### Scenario: No fixed welcome block

- **WHEN** the platform, admin, guard or operator summary page renders
- **THEN** it does not render a fixed “Bienvenido” block

