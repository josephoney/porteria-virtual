## Context

El proyecto ya tiene la señalización WebRTC funcionando (`legacy/server.js` en :3001), el kiosk React, y el dashboard React. Pero el tráfico de video/audio (media) viaja directo entre peers vía WebRTC, usando ICE para NAT traversal. Actualmente solo se configuró STUN público de Google, que no es suficiente para atravesar todos los tipos de NAT. Sin TURN, el video no funciona entre redes diferentes. Sin HTTPS, `getUserMedia` no está disponible.

Las configuraciones de coturn y nginx ya existen en `docker/` pero no están en `docker-compose.yml`.

## Goals / Non-Goals

**Goals:**
- Agregar coturn como servicio TURN/STUN en docker-compose
- Agregar nginx como reverse proxy HTTPS en docker-compose
- Generar certificados autofirmados para desarrollo local
- Configurar ICE servers en kiosk y dashboard para usar el TURN propio
- Mantener compatibilidad con el flujo de desarrollo actual (`pnpm dev` sin Docker para nginx/coturn)

**Non-Goals:**
- No se configuran certificados LetsEncrypt (producción)
- No se modifica el signaling server
- No se cambia la arquitectura de red del proyecto
- No se configura DNS público

## Decisions

### 1. Coturn en Docker

**Decisión**: Usar imagen `coturn/coturn:4.6-alpine` con configuración montada desde `docker/coturn/turnserver.conf`.

```yaml
coturn:
  image: coturn/coturn:4.6-alpine
  network_mode: host  # necesario para que TURN funcione correctamente con IPs reales
  command: turnserver -c /etc/coturn/turnserver.conf
  volumes:
    - ./docker/coturn/turnserver.conf:/etc/coturn/turnserver.conf:ro
```

**Razonamiento**: `network_mode: host` es necesario porque TURN necesita conocer la IP pública real y asignar puertos dinámicamente del rango de relay. Con bridge networking, la IP interna del contenedor no coincide con la IP pública, rompiendo el handshake ICE.

**Alternativa**: Usar bridge + `--external-ip` explícito. Más complejo de configurar, requiere conocer la IP pública de antemano.

### 2. Nginx con certificados autofirmados

**Decisión**: Generar certificados autofirmados con `openssl` y montarlos en Nginx.

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/certs/key.pem \
  -out docker/nginx/certs/cert.pem \
  -subj "/CN=localhost"
```

**Razonamiento**: Para desarrollo, certificados autofirmados son suficientes. El navegador mostrará una advertencia que se puede bypassar (en Chromium del RPi se puede usar `--ignore-certificate-errors`).

### 3. Actualizar nginx.conf para el nuevo stack

**Decisión**: Reescribir `docker/nginx/nginx.conf` para que funcione con el stack actual (React apps, API REST, signaling, todo en un mismo dominio).

```nginx
# HTTPS → Kiosk React (Vite dev en :5173 o build estático)
location /kiosk/ {
    proxy_pass http://host.docker.internal:5173/;
}

# HTTPS → Dashboard React (Vite dev en :5174 o build estático)  
location / {
    proxy_pass http://host.docker.internal:5174/;
}

# WebSocket signaling (Socket.io)
location /socket.io/ {
    proxy_pass http://host.docker.internal:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# API REST
location /api/ {
    proxy_pass http://host.docker.internal:3000;
}
```

**Razonamiento**: `host.docker.internal` permite que los contenedores Docker accedan a servicios corriendo en el host (los `pnpm dev` servers). Esto mantiene el flujo de desarrollo sin cambios.

### 4. ICE servers con TURN

**Decisión**: Agregar el TURN propio a ICE_SERVERS en ambos configs, con URL dinámica.

```typescript
ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN propio (solo en dev/red local)
    ...(isDev ? [{
        urls: `turn:${hostname}:3478`,
        username: 'porteria',
        credential: 'cambiar_esta_clave',
    }] : []),
],
```

**Razonamiento**: El TURN usa la IP del host en desarrollo. En producción se configuraría con el dominio real.

## Risks / Trade-offs

- **[Riesgo] `network_mode: host` en coturn no funciona en Docker Desktop Windows/Mac** → En Windows, Docker corre en una VM (WSL2). `network_mode: host` solo expone puertos de la VM, no del host Windows. Para desarrollo local en Windows, el TURN no es necesario (kiosk y dashboard en misma máquina). Para testing cross-network real, se necesita un VPS Linux.
- **[Riesgo] Certificados autofirmados** → Los navegadores bloquean la página por default. En Chrome/Chromium se necesita `--ignore-certificate-errors` o `thisisunsafe`.
- **[Trade-off] Nginx en desarrollo** → Agrega complejidad. Para desarrollo simple se puede seguir usando `pnpm dev` sin nginx. Nginx es necesario solo cuando se prueba con HTTPS o con múltiples dispositivos en la red.
- **[Trade-off] Sin TURN en Windows** → En desarrollo local (misma máquina), el P2P directo funciona sin TURN. El TURN es crítico solo para producción o testing cross-network real.
