# Pass Web

Public visitor page for the dynamic QR access flow. It is served at `/p/:token` and lets a visitor preview a pass, bind it to their device, and show the rotating QR.

## Development

1. Start the API with the QR feature enabled:

   ```powershell
   $env:DYNAMIC_QR_ENABLED='true'
   $env:PASS_QR_SECRET='dev-pass-qr-secret'
   $env:PASS_WEB_URL='http://localhost:5176'
   pnpm --filter @porteria/api dev
   ```

2. Start the page:

   ```powershell
   pnpm --filter @porteria/pass-web dev
   ```

3. Open the share URL returned by `POST /api/passes`, for example `http://localhost:5176/p/<token>`.

The Vite dev server proxies `/api` to `http://localhost:3000`. Override it with `API_PROXY_TARGET` if the API runs elsewhere:

```powershell
$env:API_PROXY_TARGET='http://127.0.0.1:4317'
pnpm --filter @porteria/pass-web dev
```

## Production

- Serve `dist` as a static site.
- Rewrite `/p/*` to `/index.html` so the SPA can read the token from the path. See `nginx.conf.example`.
- Proxy `/api` to the API on the same origin. The `pass_device` cookie is `HttpOnly`, `SameSite=Lax`, `Path=/api/public/passes`, and `Secure` in production, so same-origin serving is required.
- Set `PASS_WEB_URL` on the API to the public origin, for example `https://porteria.example.com`.

## Flow

- `GET /api/public/passes/:token` shows the preview (masked document, location, validity, vehicle).
- If the pass has a PIN, the visitor enters the 4 digits and the page calls `POST /bind`.
- If not, the visitor taps "Mostrar mi QR" and the page binds the device.
- Once bound, the page fetches `/qr` every 20 seconds and `/status` every 5 seconds. The QR token itself expires after 24 seconds.
- Final states (`used`, `revoked`, `expired`, `link_expired`, `device_already_bound`) stop polling and show a clear message.
