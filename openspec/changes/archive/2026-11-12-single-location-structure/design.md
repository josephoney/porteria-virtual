# Design: single location structure per community

## Context

`location_structures` currently allows many rows per community. The dashboard renders one card per row, so a community like Torre Norte shows “Estructura principal” and “Estructura 2”, each with its own “Nueva <nivel>” and “Editar estructura” actions. The domain needs one structure definition per community: how many levels it has and what each level is called. The actual towers, floors and units are `location_units` nodes inside that single structure.

The change is both a data-model correction and a UI simplification.

## Goals

- Enforce at most one `location_structures` row per community.
- Preserve every existing location unit and every historical pass/scan reference during migration.
- Show one structure header, one edit action and one root-level action in `StructureTreeDialog`.
- Expose a compact structure summary for the community detail expansion.

## Non-goals

- Changing the 1–3 level limit.
- Introducing a new tree model or replacing `location_units`.
- Automatic renaming of units whose names/codes collide after merging.
- Editing the structure name as a user-facing field; the internal name remains `Estructura principal`.
- Deleting structures from the API.

## Decisions

### 1. One structure per community

Add a unique index on `location_structures.community_id`. The API treats absence as “no structure yet” and returns a single object (or `null`), not an array, for the community-scoped read.

`POST /api/location-structures` returns `409 structure_already_exists` when the community already has one. `PATCH /api/location-structures/:id` remains the only mutation for level count and level names.

### 2. Migration picks a primary structure

The migration must handle communities with two or more structures. Selection order:

1. The structure with the most `location_units` rows.
2. Tie-breaker: the oldest `created_at`.
3. Tie-breaker: the structure named `Estructura principal`.

For every secondary structure:

1. Move its `location_units.structure_id` to the primary, preserving `parent_id`, `level_position`, `name`, `code`, `section_type`, `section_type_label`, `metadata` and `status`.
2. Update `access_passes.structure_id` and `pass_scans.structure_id` to the primary. Both FKs are `restrict`, so this must happen before deleting the secondary.
3. Delete the secondary `location_structures` row.

The migration reports, but does not auto-fix, duplicate unit names or codes under the same parent. It also reports secondary structures with zero units.

### 3. Level definition is validated in one place

`levelCount` remains 1–3. The level names are required for every existing level. `level1Name` is always required; `level2Name` is required when `levelCount >= 2`; `level3Name` is required when `levelCount = 3`.

Reducing `levelCount` is rejected with `409 structure_has_units_at_removed_level` when any unit exists at the level being removed or deeper. The API returns the offending level and count so the UI can explain the block.

### 4. Structure dialog shows one definition

`StructureTreeDialog` no longer maps structure cards. It renders:

- One header: “Estructura de la comunidad”.
- One line: `3 niveles: Torre → Piso → Apartamento`.
- One “Editar estructura” button.
- One root action: “Nueva Torre” (using `level1Name`).
- The root nodes (`levelPosition === 1`) and their descendants as today.

When the community has no structure, the dialog shows an empty state “Sin estructura definida” with “Definir estructura”. `StructureForm` creates the single structure; after creation it edits it, never creates a second one.

### 5. Structure summary for community detail

`GET /api/communities/:id/overview` adds:

```ts
structureSummary: {
  structureId: string;
  levelCount: number;
  levelNames: string[];
  level1Count: number;
  level2Count: number;
  leafCount: number;
  uniform: boolean;
  perLevel1: Array<{ id: string; name: string; level2Count: number; leafCount: number }>;
  perLevel2: Array<{ id: string; parentId: string; name: string; leafCount: number }>;
} | null;
```

Aggregation rules:

- `level1Count` = roots (`level_position = 1`).
- `level2Count` = distinct level-2 nodes.
- `leafCount` = nodes at `level_position = levelCount`.
- `uniform` is true when every level-2 node has the same leaf count and every level-1 node has the same level-2 count.
- The UI renders the natural sentence when uniform: “3 torres de 5 pisos, 3 apartamentos por piso. 45 apartamentos en total.”
- When not uniform: “3 torres · 15 pisos · 45 unidades”.
- When `structureSummary` is null: “Sin estructura definida” plus “Definir estructura”.

## Migration plan

1. Add the unique index in a new migration after the data merge, not before.
2. Run the merge inside a transaction.
3. Verify: zero communities with more than one structure; zero orphan `location_units`; zero `access_passes`/`pass_scans` pointing to deleted structures.
4. Keep a pre-migration backup. The migration is irreversible in production; document the primary-selection rule in the release notes.
5. Run the integration suite with two structures and units, including a pass and a scan referencing the secondary.

## Risks

- A secondary structure may contain units that are referenced by passes/scans; the migration must update those FKs before deleting.
- Merging roots with the same name can create duplicate display labels; report, do not auto-rename.
- Historical scans keep `structure_id`; after the merge they point to the primary, which is correct for reporting.
- The unique index will fail if the merge misses a community; run the audit query first.
- The UI must not call `POST` when a structure exists; the API 409 is the safety net.
