# Deploy de staging

Un dominio, un servidor, cuatro contenedores. La base no queda expuesta y Caddy
emite el certificado solo.

## Requisitos en el servidor

- Docker Engine 24 o superior con el plugin `docker compose` (`docker compose version`).
- Puertos **80 y 443** libres y abiertos en el firewall.
- Un registro DNS `A` del dominio apuntando a la IP del servidor.
- 4 GB de RAM como mínimo; 8 GB si además vas a correr el signaling de video.

## Primera puesta en marcha

```bash
git clone <repo> porteria && cd porteria
cp .env.staging.example .env.staging
# editar .env.staging: dominio y secretos
```

Generar los secretos:

```bash
openssl rand -hex 48   # JWT_SECRET
openssl rand -hex 32   # PASS_QR_SECRET
```

Levantar:

```bash
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

La primera vez tarda varios minutos: compila el monorepo dentro de la imagen.
Después de eso los cambios sólo reconstruyen las capas afectadas.

## Verificar

```bash
docker compose -f docker-compose.staging.yml ps
curl -s https://<dominio>/health
```

`/health` responde `{"status":"ok",...}`. Si Caddy no consigue el certificado, el
problema casi siempre es DNS: el registro tiene que apuntar al servidor y el
puerto 80 estar libre para el desafío de Let's Encrypt.

## Actualizar

Hay un script que hace todo:

```bash
bash deploy/update.sh
```

Hace `git pull`, reconstruye las imágenes que cambiaron, recrea los contenedores, limpia las imágenes viejas y muestra el estado final. Si tu archivo de entorno tiene otro nombre:

```bash
ENV_FILE=.env.otro bash deploy/update.sh
```

El servicio `migrate` corre las migraciones pendientes antes de que el API
arranque, así que no hay pasos manuales sobre la base.

## Rutas

| Ruta         | Qué sirve                             |
| ------------ | ------------------------------------- |
| `/`          | Dashboard                             |
| `/api/*`     | API                                   |
| `/p/<token>` | Pase de visita público                |
| `/kiosk/`    | Kiosco (requiere HTTPS por la cámara) |

## Datos

La base vive en el volumen `db-data`. Para respaldarla:

```bash
docker compose -f docker-compose.staging.yml exec -T db \
  pg_dump -U porteria porteria | gzip > respaldo-$(date +%F).sql.gz
```

Los datos de demo se cargan con:

```bash
docker compose -f docker-compose.staging.yml exec -e SEED_DEMO_DATA=true api \
  pnpm --filter @porteria/database db:seed
```

## La app móvil apuntando a staging

`EXPO_PUBLIC_API_URL` se compila dentro del bundle, así que hay que reconstruirla:

```bash
# apps/zima-qr-access/.env
EXPO_PUBLIC_API_URL=https://<dominio>
```

Y relanzar Metro con `--clear`.

## Problemas conocidos

- **Los eventos en vivo llegan de a bloques.** Falta el `flush_interval -1` en el
  `reverse_proxy` del Caddyfile; los streams SSE se bufferean.
- **El certificado no se emite.** El DNS todavía no propagó, o el puerto 80 está
  ocupado por otro servicio.
- **El API no arranca y dice `ECONNREFUSED`.** El contenedor `migrate` falló;
  revisar con `docker compose logs migrate`.
