## Why

The reports module measures the calls system: calls by status, calls per hour,
operator response rate, calls per kiosk. Calls were the original module of the
product but are not implemented in operation today, so the panel reports on
activity that does not happen.

What the communities actually operate is access control: visitors entering with
a QR pass or a document, and the guard shifts that cover the gate. Every one of
those events is already stored in `pass_scans` (guard, shift, access point,
community, visitor, document, vehicle, action, result, reason, scanned time,
confirmation time) and `guard_shifts` (guard, community, start, end, closing
reason), so the reports can be rebuilt without new data collection.

## What Changes

- Replace the calls-oriented report surface with two report families:
  **accesses** and **guard shifts**.
- Access report: totals by result, entries versus exits, method (QR or
  document), access point, hour of day, denial reasons, confirmation latency,
  and daily/weekly/monthly series.
- Shift report: open and closed shifts, hours per guard, accesses per shift and
  per guard, and shifts left open.
- Record the access **method** on each scan. Today an entry verified by document
  only leaves `source: 'manual_identity'` in the event payload; the scan row
  carries no method, so "QR versus document" cannot be queried.
- Export every report to **CSV, XLSX and PDF**, using the same filters and scope
  as the report on screen.
- Stop surfacing calls in the reports UI. The existing calls endpoints stay in
  place but are no longer part of the report surface.

## Capabilities

### New Capabilities

- `reports`: the access and guard-shift report surface, its metrics, its role
  scoping and its export formats.

### Modified Capabilities

None.

## Impact

- `packages/database`: new `origin` column on `pass_scans` with a migration that
  backfills from the `manual_identity` event payload and defaults to `qr`.
- `server/api`: the reports service is rebuilt around `pass_scans` and
  `guard_shifts`; new export endpoint; the manual-identity path records its
  origin.
- `apps/dashboard`: `ReportsPanel` is rebuilt around the two new families, with
  the export actions.
- No change to the scan flow, the pass state, the readable bitácora or the
  technical history.
