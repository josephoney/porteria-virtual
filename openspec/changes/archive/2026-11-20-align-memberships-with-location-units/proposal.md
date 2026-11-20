## Why

Memberships and invitations still point to the legacy `units` table, while the
configurable hierarchy stores units as leaf rows in `location_units`. A resident can be
created in the new hierarchy but the assignment flow may reference an incompatible id.

## What Changes

- Replace `memberships.unit_id` with `location_unit_id`.
- Replace `invitations.unit_id` with `location_unit_id`.
- Validate that the selected location is a leaf and belongs to the invitation/membership
  community.
- Migrate existing legacy unit references to the corresponding location units.
- Update user, invitation, membership, resident and report DTOs/UI.
- Keep the old `units` table readable during migration for compatibility.

## Capabilities

### New Capabilities

- `location-membership-binding`: location-unit scope for memberships and invitations,
  including leaf validation and migration.

### Modified Capabilities

- `membership-rbac`: membership scope uses `location_unit_id`.
- `invitation-onboarding`: invitations use `location_unit_id` for resident roles.
- `user-management`: user/membership creation accepts `locationUnitId`.

## Impact

- **DB**: FK columns, migration/backfill and legacy compatibility.
- **API**: users, memberships, invitations, residents.
- **Shared**: membership/invitation DTOs.
- **Dashboard**: unit selectors use leaf location units.
- **Depends on**: `add-configurable-location-hierarchy` and `separate-people-and-accounts`.
- **Priority**: before QR/mobile and before resident assignment work.
