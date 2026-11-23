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

## Dónde correr cada comando

El servidor sólo hospeda la aplicación. Lo que verifica código va en la máquina
de desarrollo; lo que verifica el despliegue, en el servidor.

| Comando                                          | Dónde                            | Motivo                                    |
| ------------------------------------------------ | -------------------------------- | ----------------------------------------- |
| `pnpm --filter @porteria/api test`               | Cualquier máquina                | Sólo lógica, no abre la base              |
| `pnpm --filter @porteria/api test:integration`   | **Sólo desarrollo**              | Crea y vacía filas en la base configurada |
| `pnpm --filter @porteria/database db:migrate`    | Desarrollo local, o el servidor  | Escribe el esquema                        |
| `bash deploy/update.sh`                          | Servidor                         | Reconstruye y recrea los contenedores     |
| Smoke manual                                     | Navegador y celular, contra staging | La app móvil no tiene base propia      |

### Nunca correr las pruebas de integración en el servidor

`test:integration` siembra organizaciones, personas, cuentas y pases, y después
los limpia. En el servidor `DATABASE_URL` apunta a la base de staging: correrlo
ahí es apuntar un proceso de pruebas a los datos reales.

Las unitarias (`test`) no tienen ese problema: no importan la base ni leen
`DATABASE_URL`, así que son inofensivas en cualquier lado. Igual no aportan nada
en el servidor, porque prueban el código y no el entorno.

### Verificar el código deployado

```bash
cd ~/porteria
git rev-parse --short HEAD
```

Los tests no dicen nada sobre el despliegue. El estado real se ve en `/health`,
en `docker compose ps` y en la aplicación.

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

## Archivos subidos

Los logos de organización y comunidad viven en el volumen `assets-data`, montado
en `/data/uploads`. Sobreviven a los rebuilds de `deploy/update.sh`.

Ese volumen **no está respaldado**: si se pierde, las filas de `assets` quedan
apuntando a archivos que ya no existen y el logo da 404. Respaldo pendiente (ver
`docs/backlog.md`).

## La app móvil apuntando a staging

`EXPO_PUBLIC_API_URL` se compila dentro del bundle, así que hay que reconstruirla:

```bash
# apps/zima-qr-access/.env
EXPO_PUBLIC_API_URL=https://<dominio>
```

Y relanzar Metro con `--clear`.

## Dejar Metro corriendo (tmux)

Metro muere cuando se cierra el SSH. `tmux` lo mantiene vivo en el servidor.

```bash
ssh porteria

tmux new -s expo            # crear la sesión
cd ~/porteria/apps/zima-qr-access
npx expo start -m tunnel --clear

# Ctrl+B, soltar, y D  → se sale dejando Metro corriendo
```

Para volver:

```bash
tmux ls                     # ¿sigue viva?
tmux a -t expo              # adjuntarse a ella
```

| Comando | Qué hace |
|---|---|
| `tmux new -s expo` | Crea la sesión `expo` |
| `tmux ls` | Lista las sesiones |
| `tmux a -t expo` | Se adjunta a la sesión `expo` |
| `Ctrl+B` luego `D` | **Detach**: sale y deja todo corriendo |
| `Ctrl+B` luego `[` | Modo copia para scrollear; `q` para salir |
| `Ctrl+B` luego `C` | Nueva ventana dentro de la sesión |
| `Ctrl+B` luego `N` / `P` | Ventana siguiente / anterior |
| `exit` o `Ctrl+D` | **Mata** la sesión y lo que corre dentro |

Detalles que importan:

- `Ctrl+B` es el prefijo: se suelta antes de pulsar la segunda tecla.
- Para **conservar** el proceso se usa detach (`Ctrl+B D`), nunca `exit`.
  Cerrar la ventana de SSH sin detach también deja la sesión viva.
- `tmux ls` con «no server running» significa que no queda ninguna sesión: hay
  que relanzar Metro.
- El servidor de tmux se apaga cuando no queda ninguna sesión abierta.
- Si Metro quedó corriendo desde hace días, relanzarlo con `--clear` antes de
  probar cambios de `.env` o código nativo.

## Problemas conocidos

- **Los eventos en vivo llegan de a bloques.** Falta el `flush_interval -1` en el
  `reverse_proxy` del Caddyfile; los streams SSE se bufferean.
- **El certificado no se emite.** El DNS todavía no propagó, o el puerto 80 está
  ocupado por otro servicio.
- **El API no arranca y dice `ECONNREFUSED`.** El contenedor `migrate` falló;
  revisar con `docker compose logs migrate`.
