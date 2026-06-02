# Legacy Code (Reference Only)

This directory contains the original Phase 1 implementation kept as functional reference. These files will be removed once the React apps (`apps/kiosk/`, `apps/dashboard/`) reach feature parity.

## Files

- `server.js` — Signaling server (Node.js + Express + Socket.io)
- `kiosk.html` — Touchscreen kiosk interface (vanilla JS)
- `kiosk2.html` — Kiosk variant with LAN IP config
- `operator.html` — Operator dashboard (vanilla JS)

## Running

```bash
# Start the legacy signaling server
node legacy/server.js

# Open kiosk interface
open legacy/kiosk.html

# Open operator dashboard
open legacy/operator.html
```

## Migration Status

| Legacy File | React Replacement | Status |
|-------------|-------------------|--------|
| `server.js` | `server/signaling/` | Not started |
| `kiosk.html` | `apps/kiosk/` | Not started |
| `operator.html` | `apps/dashboard/` | Not started |
