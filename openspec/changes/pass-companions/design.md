# Design: pass companions

## Context

The current pass model stores one visitor per pass. The QR, the uses counter, the entry/exit state and the guard candidate are all built around that single person. Residents routinely authorize one person who arrives with a group, and the guard currently has no way to check who else is coming. The dashboard, the mobile resident app and the bulk CSV upload all need the same concept, and the guard views need to display it without changing the scan flow.

## Goals / Non-Goals

**Goals**

- Record companions (first name, last name, document) on a pass.
- Let residents add and remove companions in the dashboard and the mobile app, and load them from the bulk CSV.
- Show companions to the guard in the identity candidate and in the pass/bitacora detail.
- Keep companions informational: one QR, one pass, one use counter.

**Non-Goals**

- Individual QR codes or individual uses for companions.
- Companion self-registration, invitations, or document verification against an external registry.
- Editing or removing companions after the pass is created.
- Searching passes by companion document.
- Showing companion documents on the public QR page.

## Decisions

### 1. Store companions as a JSONB snapshot on `access_passes`

Add `companions jsonb NOT NULL DEFAULT '[]'` typed as `PassCompanion[]` instead of a `pass_companions` table.

Rationale: companions are an immutable snapshot, the arrays are small (max 10), and the feature does not need to query or index by companion document. A table would add joins, cascade rules and a second write path for bulk creation without a current benefit. If companion search becomes a requirement, the data can be migrated to a table later.

### 2. Validation limits

Each companion requires a non-empty first name, last name and document. Reject more than 10 companions per pass and duplicate documents within the same pass. Trim and normalize fields in the API; the client may also prevent duplicates, but the API remains the authority.

### 3. Shared contract

Add `PassCompanion { firstName, lastName, document }` to `packages/shared` and `companions?: PassCompanion[]` to `CreatePassDto`. Pass detail and list responses return the full array. The public preview returns only `companionCount`; the mobile pass detail and the guard candidate receive the full array.

### 4. Visibility

Residents and guards see names and documents. The public QR page shows only the number of companions, not their documents, because the link can be shared beyond the household. If there are no companions, the UI omits the section or shows a neutral empty state.

### 5. Bulk format

The bulk CSV adds a `companions` column. Each companion is `Nombre Apellido|Documento`; companions are separated by `;`, for example `Ana Pérez|123456;Luis Gómez|789012`. The parser trims fields and reports a row-level validation error for malformed entries. JSON is not used in the CSV because it is hard to edit in Excel. The API still receives a JSON array from the dashboard and mobile clients.

### 6. Audit snapshot

Bitacora entry details include the companions that were valid at the time of the entry, exit, denial or rejection. This keeps the audit record accurate even if the pass data changes later.

### 7. No scan changes

The primary pass remains the only scannable credential. `scanPass`, `confirmScan` and `confirmIdentityEntry` keep their current rules and use counters; companions are display-only data.

## Risks / Trade-offs

- **Privacy:** companion documents in a shared link. Mitigation: the public preview exposes only `companionCount`; full data stays in authenticated resident/guard views.
- **Bulk format errors:** the delimited `companions` column can be mistyped. Mitigation: document the format, trim fields, and return a precise row error.
- **Guard UI density:** the candidate card can become long. Mitigation: show a compact companion summary with an expandable list.
- **JSONB query limitations:** no index by companion document. Accepted for now; revisit if search is requested.
- **Max 10:** a fixed limit keeps the UI and payload bounded; the limit is documented in the forms and the CSV template.

## Migration Plan

1. Add the `companions` JSONB column with default `[]`; old passes get an empty array automatically.
2. Deploy the API and the shared contract before the forms that send the new field.
3. The forms and the CSV parser accept the field; the guard views display it.
4. No data backfill and no changes to existing passes.

## Open Questions

- Whether the public page should show companion names in addition to the count. The current decision is count only, for privacy.
- Whether the maximum should be 10 or a smaller number for the mobile UI. The current decision is 10 across all surfaces.
