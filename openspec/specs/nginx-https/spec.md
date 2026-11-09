# Nginx HTTPS Reverse Proxy

## Purpose

Provides an Nginx reverse proxy with HTTPS (self-signed certs for development) that terminates TLS and routes traffic to the appropriate backend services (signaling, API, kiosk app, dashboard app).

## Requirements

### Requirement: Nginx Docker service
The docker-compose SHALL include an nginx service acting as HTTPS reverse proxy.

#### Scenario: Nginx starts
- **WHEN** `docker compose up -d` is run
- **THEN** the nginx container starts and listens on port 80 (HTTP) and 443 (HTTPS)

#### Scenario: HTTP to HTTPS redirect
- **WHEN** a request is made to port 80
- **THEN** nginx responds with a 301 redirect to HTTPS

### Requirement: SSL certificates
The project SHALL include self-signed SSL certificates for development in `docker/nginx/certs/`.

#### Scenario: Certificate files exist
- **WHEN** the nginx container starts
- **THEN** `cert.pem` and `key.pem` are found in `/etc/nginx/certs/`

#### Scenario: Certificate generation script
- **WHEN** a developer runs the cert generation script
- **THEN** a new self-signed certificate valid for 365 days is created

### Requirement: Nginx reverse proxy
Nginx SHALL proxy requests to the appropriate backend services.

#### Scenario: WebSocket signaling proxied
- **WHEN** a request arrives at `/socket.io/`
- **THEN** nginx proxies it to the signaling server with WebSocket upgrade headers

#### Scenario: API REST proxied
- **WHEN** a request arrives at `/api/`
- **THEN** nginx proxies it to the API server on port 3000

#### Scenario: Kiosk app proxied
- **WHEN** a request arrives at `/kiosk/`
- **THEN** nginx proxies it to the kiosk Vite dev server on port 5173

#### Scenario: Dashboard app proxied
- **WHEN** a request arrives at `/` (root)
- **THEN** nginx proxies it to the dashboard Vite dev server on port 5174
