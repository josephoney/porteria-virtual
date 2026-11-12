# organization-profile-ui Specification

## Purpose
TBD - created by archiving change polish-admin-workspace. Update Purpose after archive.
## Requirements
### Requirement: Logo upload is a button

In Mi Organización and in the community detail, the logo control MUST be an outline button that opens the file picker. A visible file input MUST NOT be rendered as the primary control.

#### Scenario: No logo yet

- **WHEN** the organization or community has no `logoAssetId`
- **THEN** the preview box shows “Sin logo” and the action reads “Elegir logo”

#### Scenario: Logo already uploaded

- **WHEN** a `logoAssetId` exists
- **THEN** the preview box shows the image with `object-contain`
- **THEN** the action reads “Cambiar logo”

#### Scenario: Invalid file

- **WHEN** the selected file is not PNG, JPG or WEBP, or exceeds 500 KB
- **THEN** the upload is not attempted
- **THEN** an inline error explains the accepted formats and the size limit

#### Scenario: Valid file

- **WHEN** a valid file is selected
- **THEN** the file name is shown next to the button
- **THEN** the asset is uploaded and the preview updates

### Requirement: Centered logo placeholder

The logo preview box MUST center its placeholder horizontally and vertically.

#### Scenario: Empty placeholder

- **WHEN** no logo is loaded
- **THEN** “Sin logo” is centered inside the box

#### Scenario: Same treatment on mobile

- **WHEN** the viewport is 390 pixels wide
- **THEN** the preview box keeps the placeholder centered and the button stays reachable

### Requirement: Prominent workspace name

The organization name in Mi Organización and the community name in the community detail MUST render at `text-base font-bold`, while the field label stays muted and uppercase.

#### Scenario: Organization name

- **WHEN** an `org_admin` opens Mi Organización
- **THEN** the value of the “Organización” field renders at `text-base font-bold`
- **THEN** the “Organización” label renders at `text-xs uppercase text-muted-foreground`

#### Scenario: Community name

- **WHEN** an admin expands a community row
- **THEN** the community name renders at `text-base font-bold`

