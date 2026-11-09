## 1. Schema and migration

- [x] 1.1 Add `memberships.location_unit_id`
- [x] 1.2 Add `invitations.location_unit_id`
- [x] 1.3 Backfill from legacy `units` by community and code
- [x] 1.4 Create a report of unresolved legacy references
- [x] 1.5 Keep legacy `unit_id` until verification
- [x] 1.6 Add rollback and backup notes
- [x] 1.7 Verify resident/membership counts before and after

## 2. Domain rules

- [x] 2.1 Implement leaf-unit predicate using structure `level_count`
- [x] 2.2 Reject sections, floors and intermediate nodes
- [x] 2.3 Enforce unit belongs to the invitation/membership community
- [x] 2.4 Enforce role scope: resident roles require unit, staff require community
- [x] 2.5 Accept `locationUnitId` in DTOs
- [x] 2.6 Add temporary legacy `unitId` compatibility mapping
- [x] 2.7 Add audit events for membership/invitation changes

## 3. APIs

- [x] 3.1 Update user creation to accept `locationUnitId`
- [x] 3.2 Update membership creation/update
- [x] 3.3 Update invitation creation
- [x] 3.4 Update invitation preview with community/unit path
- [x] 3.5 Update resident listings and membership responses
- [x] 3.6 Update reports using unit references
- [x] 3.7 Reject cross-organization and cross-community access
- [x] 3.8 Return 400 for invalid leaf, 404 for out-of-scope resources

## 4. Dashboard

- [x] 4.1 Replace legacy unit selectors with location leaf selectors
- [x] 4.2 Show section/level path for a unit
- [x] 4.3 Update invitation forms for resident assignments
- [x] 4.4 Update user/membership tables
- [x] 4.5 Handle the no-location-empty state

## 5. Tests

### Unit

- [x] 5.1 Leaf predicate for 1/2/3-level structures
- [x] 5.2 Reject section/floor/intermediate nodes
- [x] 5.3 Role scope validation
- [x] 5.4 Legacy `unitId` mapping
- [x] 5.5 Cover 1-, 2- and 3-level structures

### Integration

- [x] 5.6 Resident membership with leaf unit returns 201
- [x] 5.7 Resident membership with section returns 400
- [x] 5.8 Unit from another community returns 404
- [x] 5.9 Invitation with `locationUnitId` creates correct membership
- [x] 5.10 Invitation preview returns location path
- [x] 5.11 Existing residents survive migration
- [x] 5.12 Legacy mapping is reversible
- [x] 5.13 Audit events are written
- [x] 5.14 `pnpm lint` and `tsc --noEmit` pass
