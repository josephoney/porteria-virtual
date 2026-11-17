# Tasks: staging deployment

## 1. Imágenes

- [x] 1.1 `deploy/api.Dockerfile`: instalar el workspace, compilar shared, database y api, y arrancar `dist/index.js`.
- [x] 1.2 `deploy/web.Dockerfile`: compilar dashboard, pass-web y kiosco, y copiarlos a una imagen de Caddy.

## 2. Orquestación

- [x] 2.1 `docker-compose.staging.yml` con base, migraciones, API y web; sólo el proxy publica puertos.
- [x] 2.2 Healthchecks y arranque ordenado: la base sana antes de migrar, migraciones antes del API, API antes del proxy.
- [x] 2.3 Volúmenes para los datos de la base y para los certificados de Caddy.

## 3. Proxy

- [x] 3.1 `deploy/Caddyfile` con dominio por variable de entorno.
- [x] 3.2 Rutas por prefijo: `/api`, `/p`, `/kiosk` y el dashboard como fallback.
- [x] 3.3 SPA fallback en cada app y `flush_interval -1` para los streams.

## 4. Configuración y documentación

- [x] 4.1 `.env.staging.example` con todos los secretos y su generación.
- [x] 4.2 `DEPLOY.md` con primera puesta en marcha, actualización, respaldo y problemas conocidos.

## 5. Verificación

- [x] 5.1 Levantar el stack en el servidor y confirmar `/health` por HTTPS. Verificado: responde `{"status":"ok"}` con certificado de Let `'` s Encrypt.
- [x] 5.2 Entrar al dashboard por el dominio y verificar que las llamadas a `/api` funcionan sin CORS. Verificado con login real y navegacion.
- [x] 5.3 Abrir un pase por `/p/<token>` desde el teléfono, fuera de la red local. El HTML ya sirve `/p/assets/...` y los assets responden 200; verificado por HTTP.
- [x] 5.4 Confirmar que la bitácora recibe los eventos en vivo sin retraso. Verificado: el stream responde `text/event-stream` con `: connected` inmediato a traves de Caddy.
- [x] 5.5 Apuntar la app del guardia al dominio y verificar login y escaneo. Login y turno verificados contra staging desde la app; el escaneo se probo antes del cambio de dominio.
