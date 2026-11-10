# Despliegue de producción — Portería Virtual

Este directorio contiene el stack mínimo para correr Portería Virtual en un servidor con Docker: Postgres, API, signaling, MQTT bridge opcional y Caddy como reverse proxy con TLS automático.

## Requisitos

- Un servidor Linux con Docker Engine 24+ y Docker Compose v2.
- Puertos **80** y **443** abiertos (Caddy gestiona los certificados Let's Encrypt).
- Dos registros DNS apuntando al servidor:
  - `app.<dominio>` → dashboard.
  - `pases.<dominio>` → página pública de pases.
- Opcional: un tercer registro `api.<dominio>` si querés exponer la API en un host separado. Por defecto el dashboard y pass-web proxyean `/api` al mismo origen, así que no es necesario.

## 1. Preparar variables

```bash
cd deploy
cp .env.production.example .env.production
```

Editá `.env.production` y cambiá como mínimo:

- `DASHBOARD_HOST`, `PASS_WEB_HOST`, `ACME_EMAIL`.
- `POSTGRES_PASSWORD`.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PASS_QR_SECRET`, `INTERNAL_API_KEY`.

Generá secretos fuertes:

```bash
openssl rand -hex 32
```

La API **no arranca en producción** si detecta secretos por defecto, URLs sin HTTPS, `COOKIE_SECURE` distinto de `true`, CORS vacío o contraseña de Postgres por defecto.

## 2. Levantar el stack

```bash
cd deploy
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Servicios:

| Servicio      | Rol                                                              |
| ------------- | ---------------------------------------------------------------- |
| `db`          | Postgres 16 con volumen `pgdata`.                                |
| `migrate`     | Aplica migraciones Drizzle y termina.                            |
| `api`         | API Fastify en `:3000` (solo red interna).                       |
| `signaling`   | Socket.IO para llamadas y WebRTC en `:3001` (solo red interna).  |
| `mqtt-bridge` | Puente MQTT para relés en `:3002` (perfil opcional `mqtt`).      |
| `web`         | Caddy: dashboard en `app.*`, pass-web en `pases.*`, TLS y proxy. |

Verificá:

```bash
curl -fsS https://app.<dominio>/health
curl -fsS https://app.<dominio>/ready
curl -fsS https://app.<dominio>/api/version
```

`/ready` devuelve `503` si la base no responde. `/metrics` expone métricas Prometheus; recomendamos bloquearlo a nivel de red o firewall.

## 3. Primer administrador

El seed de demo está deshabilitado en producción (`SEED_DEMO_DATA=false`). El bootstrap crea la organización, la comunidad, el primer `org_admin`, un acceso inicial y, opcionalmente, el platform admin.

1. Completá las variables `BOOTSTRAP_*` en `.env.production`. La contraseña debe tener al menos 12 caracteres y no puede ser `porteria123`.
2. Ejecutá el bootstrap una sola vez:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  --profile bootstrap run --rm bootstrap
```

3. Iniciá sesión con `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`. Si `BOOTSTRAP_PLATFORM_ADMIN=true`, la cuenta también accede a la consola de plataforma.
4. El script es idempotente: si la cuenta ya existe, reutiliza la organización, la comunidad y el acceso. Para rotar la contraseña, poné `BOOTSTRAP_FORCE_PASSWORD=true` y volvé a ejecutarlo.

## 4. Backups

- Backup diario de Postgres:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backup-$(date +%F).dump"
```

- Guardá los backups fuera del servidor (S3, Backblaze, etc.).
- Probá una restauración al menos una vez por trimestre.
- El volumen `uploads` contiene los assets locales; también debe respaldarse. Si usás S3 (`ASSET_STORAGE=s3`), el backup de assets lo maneja el proveedor.

## 5. Actualizaciones

```bash
git pull
cd deploy
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

El servicio `migrate` corre antes que `api`. Si una migración falla, `api` no arranca.

## 6. MQTT (opcional)

El perfil `mqtt` levanta `mqtt-bridge`, pero **no** levanta un broker. Configurá `MQTT_HOST`/`MQTT_PORT` para apuntar a tu Mosquitto o broker gestionado. Si no usás relés, no levantes el perfil:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## 7. Logs y métricas

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

- Logs JSON de Fastify con `requestId`; los tokens de pases públicas se redaccionan.
- Métricas Prometheus en `/metrics`.
- Ver `docs/observability.md` para alertas recomendadas.

## 8. Troubleshooting rápido

| Síntoma                | Revisar                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `api` no arranca       | `docker compose logs api`; casi siempre es una variable de producción. |
| `migrate` falla        | Credenciales de Postgres, conectividad `db`, migraciones pendientes.   |
| `502` en el dashboard  | `api` caído o Caddy no puede resolver `api:3000`.                      |
| QR inválido            | `PASS_QR_SECRET` distinto entre instancias o QR vencido (24 s).        |
| Socket.IO no conecta   | Caddy no está proxyeando `/socket.io/*` a `signaling:3001`.            |
| Pass-web no abre el QR | Link ya vinculado a otro dispositivo; regenerar link.                  |

Para incidentes detallados, ver `docs/runbook-produccion.md`.
