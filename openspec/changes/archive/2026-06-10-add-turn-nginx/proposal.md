## Why

El handshake WebRTC (offer/answer/ICE) ya funciona a nivel de señalización. Pero el video nunca se establece porque:

1. **Sin TURN**: Solo usamos STUN de Google. STUN descubre IPs públicas pero no puede atravesar NATs simétricos (comunes en redes corporativas y algunos ISPs). El TURN server (coturn) hace relay del tráfico video/audio cuando el P2P directo falla. Sin TURN, WebRTC solo funciona en la misma LAN.
2. **Sin HTTPS**: `getUserMedia()` solo está disponible en contextos seguros (HTTPS o localhost). El RPi con Chromium en `http://192.168.x.x:5173` no expone la API de cámara. Nginx con certificados (autofirmados en dev) provee HTTPS y además sirve como reverse proxy unificado.
3. **ICE servers incompletos**: Los configs de kiosk y dashboard solo referencian STUN. Necesitan incluir el TURN propio.

## What Changes

- Agregar servicio `coturn` al `docker-compose.yml` (puertos 3478/udp STUN+TURN, 5349/tcp TLS, 49152-49200/udp relay)
- Agregar servicio `nginx` al `docker-compose.yml` como reverse proxy HTTPS (puertos 80→443 redirect, 443 con certificados)
- Generar certificados autofirmados para desarrollo en `docker/nginx/certs/`
- Actualizar `ICE_SERVERS` en `apps/kiosk/src/config.ts` para incluir TURN
- Actualizar `ICE_SERVERS` en `apps/dashboard/src/config.ts` para incluir TURN
- Script de generación de certificados (`docker/nginx/generate-certs.sh` o vía openssl)

## Capabilities

### New Capabilities
- `turn-server`: Coturn corriendo como contenedor Docker, configurado con puertos STUN/TURN, relay UDP, y credenciales de desarrollo.
- `nginx-https`: Nginx como reverse proxy HTTPS con certificados autofirmados para desarrollo, redirigiendo tráfico al signaling server y sirviendo archivos estáticos.
- `ice-turn-config`: Configuración de ICE servers en kiosk y dashboard incluyendo el servidor TURN propio.

### Modified Capabilities
- `docker-compose` (implícito, no está en specs): Se agregan 2 servicios (coturn, nginx) y volúmenes de certificados.

## Impact

- **docker-compose.yml**: +2 servicios (coturn, nginx), +2 volúmenes
- **apps/kiosk/src/config.ts**: ICE_SERVERS incluye TURN
- **apps/dashboard/src/config.ts**: ICE_SERVERS incluye TURN
- **docker/nginx/certs/**: Nuevo directorio con certificados autofirmados
- **docker/coturn/turnserver.conf**: Ya existe, se usa tal cual
- **docker/nginx/nginx.conf**: Requiere ajustes para servir apps React y API REST
- **Puertos nuevos**: 80, 443/tcp, 3478/udp, 5349/tcp, 49152-49200/udp
