# Design: staging deployment

## Context

El monorepo usa pnpm workspaces y el API depende de `@porteria/shared` y `@porteria/database` compilados. Tres apps son estáticas (dashboard, pass-web, kiosco) y una es móvil, que no se despliega.

## Decisions

### 1. Dos imágenes, no seis

Un `api.Dockerfile` que incluye la API y sirve también para correr las migraciones, y un `web.Dockerfile` que compila las tres apps estáticas y las sirve con Caddy. Seis contenedores para cuatro servicios agregan arranque lento y más lugares donde fallar.

### 2. Caddy sirve los estáticos y hace de proxy

Evita un contenedor nginx por app. Caddy resuelve TLS, enrutamiento por prefijo y SPA fallback en un solo archivo, y la configuración se lee en segundos cuando algo no anda.

### 3. El dominio va por variable de entorno

`{$STAGING_DOMAIN}` en el Caddyfile y `STAGING_DOMAIN` en el compose. El repo no queda atado a un dominio, y cambiar de staging a producción es cambiar el `.env` y reiniciar.

### 4. Las migraciones son un servicio de un solo uso

`migrate` corre `drizzle-kit migrate` y termina; la API espera `service_completed_successfully`. Así el deploy no depende de que alguien recuerde ejecutarlas a mano, y si fallan el API no arranca en vez de servir con el esquema viejo.

Por eso la imagen final conserva `node_modules`: drizzle-kit es dependencia de desarrollo. Es un intercambio consciente entre tamaño de imagen y un paso menos en el servidor.

### 5. La base no publica puertos

Sólo `web` expone 80 y 443. Postgres y la API viven en la red de compose.

### 6. Mismo origen, sin CORS

Todo pasa por el dominio, así que `CORS_ORIGINS` queda vacío y el dashboard usa `window.location.origin`. De paso desaparece el problema de las IPs privadas que había en desarrollo.

### 7. El kiosco se sirve desde `/srv` con su prefijo

Compila con base `/kiosk/`, así que sus assets se piden como `/kiosk/assets/...`. Servirlo con `root /srv` hace que esa ruta resuelva a `/srv/kiosk/assets/...` sin reescrituras.

## Risks

- **Streams SSE buffereados.** Si el proxy no reenvía al instante, los eventos en vivo llegan en bloque. Mitigado con `flush_interval -1`.
- **Certificado.** Sin DNS apuntando al servidor, Caddy no emite y el sitio no responde por HTTPS.
- **Una sola réplica.** El bus de eventos vive en memoria. Con más de una instancia del API hace falta Redis pub/sub.
