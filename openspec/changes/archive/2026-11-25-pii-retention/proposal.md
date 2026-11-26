## Why

The system keeps the visitor's identity in four places at once: `people`, the
pass snapshot in `access_passes`, the scan snapshot in `pass_scans`, and the
details payload of every `bitacora_entries` row. Nothing ever removes it, so the
document number of someone who visited once stays there forever.

The organization is the data controller — it hires the platform — so the
retention window is its decision, not the product's. Twelve months is the
agreed starting point: enough to answer a security question about a visit,
short enough not to keep an identity longer than the purpose requires.

Deleting rows is not an option: the access record is the community's security
log and the reports are built on it. What has to disappear is the identity, not
the event. Anonymizing keeps the type, the result, the reason, the time, the
gate and the shift, and removes the name, the document, the plate, the
companions and the author's name. Totals do not move because the reports never
read personal data.

## What Changes

- Every organization gets a **retention window**, twelve months by default,
  editable by its administration.
- A **retention worker** anonymizes visitor identity in passes, scans and the
  access log once the window has passed. It does not delete rows.
- Each run leaves a **record**: organization, date, counts per table, and
  whether it was a dry run.
- The worker runs **in dry run by default**. Anonymizing production data is
  irreversible, so it only writes when the environment explicitly enables it.
- The resident directory (`people`) is **out of scope**: retention applies to
  the visitor data of the access record, not to the community's own members.

## Capabilities

### New Capabilities

- `data-retention`: the window, the anonymization of visitor identity in the
  access record, and the audit of each run.

### Modified Capabilities

None.

## Impact

- `packages/database`: new `retention_months` column on `organizations` with a
  default of twelve, and a `retention_runs` table for the audit of each sweep.
- `server/api`: a scrub service, a scheduled worker, the organization profile
  endpoint accepts the window, and a read endpoint for the run history.
- `apps/dashboard`: the organization profile exposes the window with an honest
  explanation of what disappears and what stays.
- No change to the scan flow, the pass state, the reports or the readable board.
