# Proposal: pass companions

## Why

A pass currently authorizes one visitor. In practice people arrive in groups: the resident authorizes one person, and that person comes with family, coworkers or friends. The guard has no record of who is accompanying the primary visitor, so the group is admitted on trust or the guard has to ask the resident. Bulk invitations have the same gap.

Companions are informational. They do not get their own QR, do not consume separate uses, and do not change scanning or entry/exit rules. They are associated with the primary pass so the guard can verify names and documents at the gate.

## What Changes

- Each pass can include zero or more companions, each with first name, last name and document.
- Residents add or remove companions when creating an authorization in the dashboard, in the mobile resident app, and in bulk CSV uploads.
- The guard sees companions on the identity candidate and on the pass/bitacora detail.
- The public QR page does not expose companion documents; it only shows how many companions are associated.
- Companions are a snapshot: editing them after creation is out of scope.
- Companion data is validated: required fields, at most 10 per pass, and no duplicate documents within the same pass.

## Capabilities

### New Capabilities

- `pass-companions`: a pass can carry informational companions associated with the primary visitor.

### Modified Capabilities

None. The resident forms, bulk upload and guard views are covered by the new capability.

## Impact

- `access_passes` gains a JSONB `companions` column with default `[]`; no backfill of old rows.
- `packages/shared/src/dto/passes.ts` adds `PassCompanion` and `companions` to `CreatePassDto` and to the public/detail responses.
- `server/api/src/services/pass.service.ts` (create, batch, list/detail) and `access-scan.service.ts` (identity candidate and bitacora details).
- `apps/dashboard`: create form, bulk page and history/detail.
- `apps/zima-qr-access`: create form, pass detail, identity check and bitacora.
- No changes to QR signing, scan/confirm rules, or pass uses.
