## ADDED Requirements

### Requirement: Logo asset storage

The system SHALL store organization and community logo files through a storage adapter.

#### Scenario: Store asset metadata
- **WHEN** a logo is uploaded
- **THEN** an `assets` row records organization, optional community, kind, storage key,
  MIME type, size and checksum
- **THEN** the binary is not stored in the database

#### Scenario: Local development adapter
- **WHEN** the environment uses local storage
- **THEN** the file is persisted outside the database
- **THEN** the API returns a readable URL or asset endpoint

#### Scenario: Production adapter
- **WHEN** the environment uses S3-compatible storage
- **THEN** the adapter persists and deletes objects by storage key
- **THEN** profile/domain logic does not depend on the provider

### Requirement: Logo validation

Logo uploads SHALL be validated before storage.

#### Scenario: Allowed formats
- **WHEN** the file is PNG, JPEG or WEBP
- **THEN** the upload is accepted

#### Scenario: Invalid format
- **WHEN** the file is GIF, SVG, PDF or another format
- **THEN** the upload is rejected with status 400

#### Scenario: Maximum size
- **WHEN** the file exceeds 500 KB
- **THEN** the upload is rejected with status 400

#### Scenario: Recommended square
- **WHEN** the file is not square
- **THEN** the upload is accepted
- **THEN** the UI shows a recommendation to use a square image

### Requirement: Organization logo

Organizations SHALL have an optional logo with default fallback.

#### Scenario: Set organization logo
- **WHEN** an org admin uploads a logo for their organization
- **THEN** the organization profile references the new asset
- **THEN** the sidebar header uses the logo

#### Scenario: Replace organization logo
- **WHEN** an org admin uploads a replacement
- **THEN** the previous asset is deleted or deactivated
- **THEN** the new asset is used

#### Scenario: Organization fallback
- **WHEN** the organization has no logo
- **THEN** the current default platform icon is displayed

### Requirement: Community logo

Communities SHALL have an optional logo with default fallback.

#### Scenario: Set community logo
- **WHEN** an authorized admin uploads a logo for a community
- **THEN** the community profile references the new asset
- **THEN** the community view uses the logo

#### Scenario: Replace community logo
- **WHEN** a community logo is replaced
- **THEN** the previous asset is deleted or deactivated

#### Scenario: Community fallback
- **WHEN** the community has no logo
- **THEN** the default platform icon is displayed

### Requirement: Asset authorization

Asset operations SHALL respect tenant scope.

#### Scenario: Cross-organization asset
- **WHEN** an org admin requests or replaces an asset from another organization
- **THEN** the response has status 404

#### Scenario: Community asset scope
- **WHEN** a community admin uploads a logo
- **THEN** the asset belongs to the organization and the assigned community

#### Scenario: Audit
- **WHEN** an asset is uploaded, replaced or deleted
- **THEN** an audit event records actor, organization, community and asset id
