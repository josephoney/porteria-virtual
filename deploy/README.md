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

El volumen de Postgres **no es un respaldo**: sobrevive a un rebuild, pero se va
con el disco, con un `DELETE` sin `WHERE` o con la cancelación de la VPS. El
respaldo real es una copia **fuera del servidor**.

### El script

`deploy/backup.sh` hace el ciclo completo:

1. `pg_dump --format=custom` desde el contenedor `db`.
2. Verifica el archivo (tamaño, firma `PGDMP` y `pg_restore -l`) antes de darlo por bueno.
3. Sube el dump y su `.sha256` a un bucket S3 compatible con `rclone`.
4. Borra los respaldos locales y remotos más viejos que `BACKUP_RETENTION_DAYS`.

```bash
# Producción (detecta deploy/docker-compose.prod.yml y deploy/.env.production)
bash deploy/backup.sh

# Staging
COMPOSE_FILE=docker-compose.staging.yml ENV_FILE=.env.staging bash deploy/backup.sh
```

Los archivos quedan en `backups/` (ignorado por git) como
`porteria-YYYYMMDDTHHMMSSZ.dump`. El script toma un lock: si ya hay uno
corriendo, sale sin hacer nada.

### Configuración

En `.env.staging` o `deploy/.env.production`:

| Variable                                                  | Para qué                                                 |
| --------------------------------------------------------- | -------------------------------------------------------- |
| `BACKUP_S3_ENDPOINT`                                      | Endpoint S3 compatible del proveedor                     |
| `BACKUP_S3_BUCKET`                                        | Bucket de destino                                        |
| `BACKUP_S3_REGION`                                        | Región (default `us-east-1`)                             |
| `BACKUP_S3_PREFIX`                                        | Carpeta dentro del bucket (default `porteria`)           |
| `BACKUP_S3_ACCESS_KEY_ID` / `BACKUP_S3_SECRET_ACCESS_KEY` | Credenciales con permiso de escritura y borrado          |
| `BACKUP_S3_FORCE_PATH_STYLE`                              | `true` para la mayoría de los proveedores S3 compatibles |
| `BACKUP_RETENTION_DAYS`                                   | Días de retención local y remota (default 14)            |
| `SKIP_OFFSITE`                                            | `1` para un respaldo sólo local (pruebas)                |

Sin `BACKUP_S3_*` el script **avisa y deja el dump sólo en el servidor**. Sirve
para probar, pero no cumple el objetivo: si se pierde la máquina, se pierde el
respaldo.

### Programarlo

Con systemd (recomendado, sobrevive a reinicios y queda en `journalctl`):

```bash
cp deploy/systemd/porteria-backup.service deploy/systemd/porteria-backup.timer /etc/systemd/system/
# ajustar WorkingDirectory y la ruta del repo en el .service
systemctl daemon-reload
systemctl enable --now porteria-backup.timer
systemctl list-timers porteria-backup.timer
```

Con cron:

```cron
30 3 * * * cd /root/porteria && mkdir -p backups && /usr/bin/env bash deploy/backup.sh >> backups/cron.log 2>&1
```

### Verificar

```bash
tail -n 20 backups/backup.log
```

La línea `Dump OK` es el archivo validado; `Subida OK` confirma que está en el
bucket y que el tamaño remoto coincide. Si aparece `AVISO: falta configurar
BACKUP_S3_*`, el respaldo no salió del servidor.

### Restaurar

```bash
# Ver qué contiene el archivo, sin tocar nada
bash deploy/restore.sh backups/porteria-20260101T033000Z.dump --list

# Restaurar (detiene api y web, pide confirmación escrita)
bash deploy/restore.sh backups/porteria-20260101T033000Z.dump --confirm
```

El detalle del procedimiento y cómo verificar después está en
`docs/runbook-produccion.md`, sección 10.

**Probá una restauración al menos una vez por trimestre.** Un backup que nunca
restauraste no es un backup: es una esperanza. Cronometralo: ese número es el
RTO real.

### Los archivos subidos

El volumen `uploads` con los assets locales **no lo toca este script**. Se
respalda aparte y, si algún día pasás a `ASSET_STORAGE=s3`, lo maneja el
proveedor.

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
