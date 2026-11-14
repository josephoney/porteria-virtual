# Proposal: staging deployment

## Why

Hoy el sistema corre con `pnpm dev:full` en una máquina de desarrollo. El dashboard vive en el 5174, la API en el 3000 y cada app móvil lleva una IP horneada en el bundle. Probar desde otra red obliga a pelear con CORS, firewalls y variables recompiladas.

Staging con el mismo stack que producción resuelve eso de raíz: un dominio, un certificado, y todos los servicios detrás de un proxy.

## What Changes

- `docker-compose.staging.yml` con base, migraciones, API y web.
- `deploy/api.Dockerfile` y `deploy/web.Dockerfile`, construidos desde la raíz del monorepo.
- `deploy/Caddyfile` con un dominio por variable de entorno, TLS automático y rutas por prefijo.
- `.env.staging.example` y `DEPLOY.md` con el paso a paso y los problemas conocidos.

## Capabilities

### New Capabilities

- `staging-deployment`: el sistema se levanta y se actualiza con un comando, en un dominio propio y sin puertos sueltos.

### Modified Capabilities

- Ninguna.

## Impact

- Archivos nuevos de despliegue; sin cambios en el código de las apps.
- La app móvil deja de apuntar a una IP y pasa a apuntar al dominio.
- El signaling de video queda fuera del primer recorte.

## Fuera de alcance

- Producción con respaldos automáticos y monitoreo.
- Signaling, TURN y MQTT: se agregan cuando haya video en uso.
- CI/CD: el deploy es `git pull` más `docker compose up`.
