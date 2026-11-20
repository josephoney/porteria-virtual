## 1. Schema and migration

- [x] 1.1 Create `location_structures` (community, name, level_count, level names)
- [x] 1.2 Create `location_units` (structure, parent, level_position, name, code, section_type, section_type_label, metadata)
- [x] 1.3 Create `location_residents` (location_unit, person, relationship, validity)
- [x] 1.4 Add constraints: parent same structure, level+1, no cycles, unique sibling code, valid section type, `other` requires label
- [x] 1.5 Add indexes for community/structure/parent
- [x] 1.6 Generate and review the migration
- [x] 1.7 Migrate buildings → typed sections at level 1, floors → level 2, units → level 3
- [x] 1.8 Migrate legacy residents/membership unit references
- [x] 1.9 Add rollback and backup notes

## 2. Domain service

- [x] 2.1 Implement structure create/update/rename levels
- [x] 2.2 Implement node create/move/delete with constraints
- [x] 2.3 Implement level_count expansion/reduction rules
- [x] 2.4 Implement unit/leaf detection
- [x] 2.5 Implement resident associations and history
- [x] 2.6 Add tenant/community scope checks
- [x] 2.7 Add unit tests for cycles, invalid parents, delete-with-children
- [x] 2.8 Validate section type catalog and `other` label

## 3. API

- [x] 3.1 Add `GET/POST/PATCH /api/communities/:id/location-structures`
- [x] 3.2 Add `GET/POST/PATCH /api/location-structures/:id/units`
- [x] 3.2a Add paginated `GET /api/sections` with community/type/search filters
- [x] 3.2b Add `POST /api/sections` and `PATCH /api/sections/:id`
- [x] 3.3 Add `POST /api/location-units/:id/move`
- [x] 3.4 Add `POST /api/location-units/:id/residents`
- [x] 3.5 Add resident list/detail
- [x] 3.6 Enforce RBAC/scope
- [x] 3.7 Add audit events for structure/node/resident changes

## 4. Dashboard

- [x] 4.1 Build a tree view per community
- [x] 4.1a Build the Secciones table with type, community, levels, units and status
- [x] 4.2 Add structure creation with level names (1–3)
- [x] 4.3 Add node create/edit/move
- [x] 4.4 Add resident associations
- [x] 4.5 Show validation errors and empty/loading states
- [x] 4.6 Reflect the new structure in the community selector

## 5. Migration and compatibility

- [x] 5.1 Keep legacy `buildings`/`units` readable during migration
- [x] 5.2 Add a feature flag for the new hierarchy
- [x] 5.3 Verify existing residents/data after migration
- [x] 5.4 Document the migration and rollback
- [x] 5.5 Prepare `unit_id` → `location_unit_id` for the QR change

## 6. Verification

- [x] 6.1 Create 1, 2 and 3-level structures
- [x] 6.2 Create two different structures in the same community
- [x] 6.3 Move a subtree without losing residents
- [x] 6.4 Rename levels
- [x] 6.5 Reject cycles, invalid parents, delete-with-children
- [x] 6.6 Migrate demo buildings/units and verify counts
- [x] 6.7 `pnpm lint` and `tsc --noEmit` pass
- [x] 6.8 Verify section type filters, `other` label and type edits preserve children
