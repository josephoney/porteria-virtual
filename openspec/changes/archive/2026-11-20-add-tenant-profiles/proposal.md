## Why

Organizations and communities currently only store their name, slug and, for
communities, a basic address. The administrative dashboard cannot show the legal and
contact data needed by a real tenant, and there is no branding or welcome experience.

## What Changes

- Add organization profile data: NIT, phone, address, legal representative, logo and
  welcome message.
- Add community profile data: phone, type/custom label, address, coordinates, logo and
  welcome message.
- Add a reusable asset upload model for organization and community logos.
- Resolve the organization administrator from an active `org_admin` membership and a
  person record, not from duplicated organization text fields.
- Keep NIT optional at organization creation and unique when present, without a check
  digit.
- Restrict profile editing to the organization administrator; the superadmin can only
  read profiles.
- Display organization/community logos with the existing default icon as fallback.

## Capabilities

### New Capabilities

- `organization-profile`: organization contact, legal representative, logo, welcome and
  administrator read model.
- `community-profile`: community contact, type, coordinates, logo, welcome and
  administrator assignment.
- `tenant-branding`: organization/community logo upload, validation, replacement and
  fallback behavior.

### Modified Capabilities

- `tenancy-model`: community columns gain phone, type, coordinates, logo and welcome
  message.

## Impact

- **DB**: `organizations`, `communities`, new `assets`, optional legal representative FK.
- **API**: organization/community profile endpoints and authenticated asset upload.
- **Dashboard**: organization profile and community profile forms.
- **Storage**: local filesystem in development, S3-compatible adapter in production.
- **Depends on**: `separate-people-and-accounts` for people and legal representative.
- **Priority**: after people/account separation and location-unit alignment.
