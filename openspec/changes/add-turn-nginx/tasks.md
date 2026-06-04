## 1. SSL Certificates

- [x] 1.1 Create `docker/nginx/certs/` directory
- [x] 1.2 Generate self-signed certificate with openssl: `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout docker/nginx/certs/key.pem -out docker/nginx/certs/cert.pem -subj "/CN=localhost"`
- [x] 1.3 Add `docker/nginx/certs/` to `.gitignore` (certs are local, not committed)

## 2. Docker Compose — Nginx

- [x] 2.1 Add `nginx` service to `docker-compose.yml`: image `nginx:alpine`, ports 80:80 + 443:443, volumes for nginx.conf and certs
- [x] 2.2 Rewrite `docker/nginx/nginx.conf` for current stack: proxy `/` to dashboard :5174, `/kiosk/` to kiosk :5173, `/socket.io/` to signaling :3001, `/api/` to API :3000, `/health` to signaling
- [x] 2.3 Use `host.docker.internal` for proxy_pass targets (Docker → host access)

## 3. Docker Compose — Coturn

- [x] 3.1 Add `coturn` service to `docker-compose.yml`: image `coturn/coturn:4.6-alpine`, `network_mode: host`, mounted config
- [x] 3.2 Verify `docker/coturn/turnserver.conf` has correct credentials and relay port range

## 4. ICE Servers — Kiosk

- [x] 4.1 Update `apps/kiosk/src/config.ts` ICE_SERVERS to include TURN in dev mode: `turn:<hostname>:3478` with username `porteria` and credential from config
- [x] 4.2 Remove hardcoded credential — read from config or constant

## 5. ICE Servers — Dashboard

- [x] 5.1 Update `apps/dashboard/src/config.ts` ICE_SERVERS to include TURN in dev mode, matching kiosk config
- [x] 5.2 Ensure ICE_SERVERS is identical between kiosk and dashboard

## 6. Build & Verify

- [x] 6.1 Run `docker compose up -d` — verify nginx and coturn start alongside postgres, redis, mosquitto
- [x] 6.2 Run `docker compose ps` — verify all 5 services are running
- [x] 6.3 Verify nginx HTTPS: `curl -k https://localhost/health`
- [x] 6.4 Verify TURN: check coturn logs for "IPv4. TCP listener opened"
- [x] 6.5 Build both apps: `pnpm --filter @porteria/kiosk build && pnpm --filter @porteria/dashboard build`
- [x] 6.6 Verify ICE_SERVERS in built JS includes TURN URL
