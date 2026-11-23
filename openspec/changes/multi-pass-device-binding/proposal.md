## Why

A pass link binds to the first device that opens it. That is intentional: if the
link is forwarded, it must not work on another phone. The binding travels in a
single cookie, and the cookie carries **one** pass id.

So the rule that protects a pass (one pass, one device) was implemented as a
stronger rule that nobody asked for: one browser, one pass. Opening a second
pass overwrites the cookie, and the first pass starts answering `not_bound`.
It was never revoked, used, or expired; the browser simply forgot it was
authorized.

This hurts the most common real case: a courier delivering to two units receives
two links, opens both, and the second silently cancels the first. The guard then
rejects a pass that is perfectly valid.

## What Changes

- Bind one cookie per pass instead of one cookie for the entire browser. Each
  pass keeps its own device key and its own first-device rule.
- Opening a pass never invalidates another pass previously opened on the same
  device.
- Keep reading the current single-pass cookie as a fallback, so no device loses
  access because of the deploy.
- Add a device-scoped index: the phone can list the passes it holds, with a link
  to each one, so a courier does not have to keep two tabs open.

**Not in scope**

- A single QR that authorizes several passes at once. Each pass keeps its own
  token, its own uses and its own audit trail.
- Transferring a pass to another device after it was bound.
- Physical access devices (kiosks, turnstiles, relays). That is a separate
  capability.

## Capabilities

### New Capabilities

- `public-pass-access`: how a public pass link binds to a device, how several
  passes coexist on the same device, and how the device lists them.

### Modified Capabilities

None.

## Impact

- `server/api/src/lib/device-cookie.ts`: cookie naming per pass plus a legacy
  reader.
- `server/api/src/routes/public-pass.routes.ts`: set the pass-scoped cookie and
  keep setting the legacy one during the transition.
- `server/api/src/lib/pass-tokens.ts`: unchanged signature scheme; only the
  cookie name selection is new.
- `server/api/src/services/public-pass.service.ts`: `isBound` accepts the
  pass-scoped cookie; the legacy cookie keeps working.
- New endpoint for the device index and its public UI entry point.
- No database migration. No change to `access-passes.device_key_hash`, to the
  scan flow, or to the guard confirmation.
