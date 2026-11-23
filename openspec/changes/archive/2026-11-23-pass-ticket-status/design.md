# Design — Pass ticket status

## Context

The dynamic QR rotates every few seconds. The current ticket shows the visitor and the validity window, but not whether the pass is pending entry, inside, or finished. The pass API already returns `status`, `presence_state`, `entry_count`, `exit_count`, `max_uses`, `recurrence` and `valid_until`; the detail endpoint also returns `rule.remaining_uses`. Two surfaces render the ticket: the mobile pass detail (`apps/zima-qr-access/app/pass/[id].tsx`) and the public web page (`apps/pass-web`).

## Goals / Non-Goals

**Goals**

- One shared derivation so the mobile app and the web page never disagree.
- A state that answers “can this person enter now?” at a glance.
- Accessible signals: color plus icon plus text.
- No changes to scan or confirmation behavior.

**Non-Goals**

- New server states or a new pass lifecycle.
- Notifications, push messages, or a redesign of the scan flow.
- Changing how often the QR token rotates.

## Decisions

- **Daily exhaustion is a warning, not a final state.** A `range` or `weekly` pass with zero uses left today shows «Sin usos hoy» and becomes available again on the next allowed day. Only `once` exhausted, `used`, `expired` and `revoked` are final.

1. **Shared pure helper.** Add `passTicketState(pass, now)` in `packages/shared`, returning `{ tone, label, detail, icon }`. Both surfaces render the same object. This is testable without React Native or the DOM.

2. **Precedence.** Evaluate in this order: revoked → expired/used → inside → re-entry → pending. Final states win; an inside visitor is never shown as “pending” even if the token was just renewed.

3. **Tones.** Pending entry and re-entry use the success tone (green); inside uses the warning tone (orange); used, expired and revoked use the danger or muted tone. The label and icon always travel with the color, so color is never the only signal.

4. **Uses.** Read `rule.remaining_uses` when the detail endpoint provides it. For a `once` pass without a rule, derive the remaining uses as `max_uses - exit_count`. For `range` and `weekly`, the rule is the source of truth; if it is missing, show the state without a counter rather than inventing one.

5. **QR rotation is orthogonal.** The state is read from the pass response. The ticket may refetch on focus and after each rotation, but a new token never resets the state.

6. **Public endpoint.** If the public preview does not expose `presence_state`, `entry_count`, `exit_count` or `rule`, extend that response instead of creating a second endpoint. Without those fields the web page can only show final states.

7. **Copy.** Labels are Spanish and never expose `once | range | weekly`. The counter reads “1 de 2 usos hoy” for daily passes and “1 de 2 usos” for one-time passes.

## Risks / Trade-offs

- **Stale ticket.** A pass can change on the server while the screen is open. Mitigate with a refetch on focus and after each QR rotation; the server remains authoritative.
- **Public data gap.** The public endpoint may lack presence and counters. Extending it is a small, additive change; the alternative is a web page that only shows final states.
- **Color semantics.** Orange “inside” and green “can re-enter” could be confused with “valid” and “invalid”. The icon and label carry the meaning; the color only reinforces it.
- **Extra requests.** Refetching on rotation is a small payload and only happens while the ticket is visible.

## Migration Plan

No database migration. The change is additive: ship the shared helper, render it in both surfaces, and extend the public response only if the fields are missing. No feature flag is needed because the state is read-only.

## Open Questions

- Does the public preview already include `presence_state`, `entry_count`, `exit_count` and `rule`? If not, which fields must be added?
- Should the public page show the remaining-uses counter, or only the state? The counter is not personal data, but it may be unnecessary for the visitor.
- Confirm the final copy for revoked versus expired passes.
