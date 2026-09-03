const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
const isPrivateIP =
  hostname.match(/^192\.168\./) ||
  hostname.match(/^10\./) ||
  hostname.match(/^172\.(1[6-9]|2\d|3[01])\./) ||
  hostname.match(/^169\.254\./) ||
  hostname.match(/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./);

// Dev se detecta por servir sobre HTTP en localhost/IP privada.
// Si la pagina llega por HTTPS (nginx con cert self-signed), es
// produccion aunque la IP sea privada: usar same-origin para no
// caer en mixed content (ws:// bloqueado desde pagina https://).
const isDev =
  window.location.protocol === 'file:' ||
  window.location.protocol === 'http:' && (isLocalhost || isPrivateIP);

const TURN_SERVER = {
  urls: `turn:${hostname}:3478`,
  username: 'porteria',
  credential: 'cambiar_esta_clave',
};

function resolveServerUrl(): string {
  const envUrl = import.meta.env.VITE_SIGNALING_URL as string | undefined;
  if (envUrl) return envUrl;

  // Dev: connect directly to signaling server (bypass nginx)
  // Prod: use same origin — nginx proxies /socket.io/
  if (isDev) {
    return isLocalhost
      ? 'http://localhost:3001'
      : `http://${hostname}:3001`;
  }
  return window.location.origin;
}

export const CONFIG = {
  SERVER_URL: resolveServerUrl(),
  BUILDING_ID: import.meta.env.VITE_BUILDING_ID || 'edificio-01',
  BUILDING_NAME: import.meta.env.VITE_BUILDING_NAME || 'EDIFICIO PRINCIPAL',
  ADDRESS: 'Calle 123 #45-67, Bogotá',
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(isDev ? [TURN_SERVER] : []),
  ],
} as const;
