## Why

The current dashboard presents organizations, communities, sections and units as flat
tables. Superadmins cannot inspect a tenant profile, and organization administrators
cannot create communities or navigate the hierarchy from their own scope.

## What Changes

- Add an expandable organization overview for the superadmin, read-only.
- Add an organization overview returned by the API with profile, legal representative,
  administrator, communities and location counts.
- Add a community overview with sections and level counts.
- Add a **Mi Organización** menu for organization administrators.
- Allow organization administrators to create communities.
- Allow a community administrator to be assigned to multiple communities through
  memberships.
- Make superadmin tenant views read-only.
- Show organization/community branding and welcome messages in the hierarchy.

## Capabilities

### New Capabilities

- `admin-hierarchy-views`: expandable organization/community views and role-specific
  administrative navigation.

### Modified Capabilities

- `platform-console`: community, section and unit management becomes read-only for the
  platform administrator.
- `membership-rbac`: organization administrators manage all communities in their
  organization; community administrators can have multiple community memberships and
  cannot create communities.

## Impact

- **API**: organization/community overview read models; org-admin community creation.
- **Dashboard**: superadmin organization rows, org-admin Mi Organización, community
  creation and drilldown.
- **Depends on**: `add-tenant-profiles`, `align-memberships-with-location-units`,
  `extend-admin-hierarchy`.
- **Priority**: after tenant profiles and membership/location alignment.
