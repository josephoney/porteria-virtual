## Why

A dynamic QR renews every few seconds, and the ticket does not clearly say what state the pass is in. A visitor who already entered sees a fresh QR and may try to scan again, believing it is unused, when the entry was approved and the pass is waiting for the exit. That causes double scans, confusing guard decisions, and avoidable support.

The guard already sees the rule and the remaining uses when validating a document or a QR. The person holding the ticket does not: the ticket only shows the visitor, the destination, and the validity window.

## What Changes

- Add a visible ticket state derived from the pass, never from the QR token or its countdown:
  - **Pendiente de ingreso** (green): active, outside, with uses available.
  - **Adentro · esperando salida** (orange): the visitor is inside on an entry/exit pass.
  - **Puede volver a entrar** (green, with the remaining counter): after an exit on a multi-use pass that still has uses.
  - **Usado / Vencido / Revocado** (red or gray, final): the pass no longer authorizes.
- Render the state with color **and** icon **and** text, so it does not depend on color alone.
- Keep the state stable while the QR renews. A new QR token never resets the ticket to "pending entry".
- Treat `entry_only` as consumed on entry: it goes from pending to used, without an orange "inside" state.
- Apply the same state and wording on the mobile pass ticket and on the public web pass view, so both show the same truth.
- Reuse the existing pass fields (`status`, `presence_state`, `entry_count`, `exit_count`, `max_uses`, `recurrence`, `valid_until`, `rule.remaining_uses`). If the public endpoint does not expose them yet, extend its response without changing scan or confirmation behavior.

## Capabilities

### New Capabilities

- `pass-ticket`: the QR ticket communicates the pass state with color, icon, and text, derived from the pass data and independent of QR renewal.

### Modified Capabilities

- None.

## Impact

- `apps/zima-qr-access/app/pass/[id].tsx` and its pass types.
- `apps/pass-web` QR and preview components.
- A shared helper and type in `packages/shared` so both clients derive the state with the same rules.
- Possibly the public pass response if it does not return presence or the use counters.
- No database migration and no change to scan, confirmation, or rejection logic.
