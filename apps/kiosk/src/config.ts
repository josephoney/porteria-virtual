const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
const isPrivateIP =
  hostname.match(/^192\.168\./) ||
  hostname.match(/^10\./) ||
  hostname.match(/^172\.(1[6-9]|2\d|3[01])\./) ||
  hostname.match(/^169\.254\./);
const isDev = window.location.protocol === 'file:' || isLocalhost || isPrivateIP;

const TURN_SERVER = {
  urls: `turn:${hostname}:3478`,
  username: 'porteria',
  credential: 'cambiar_esta_clave',
};

const isHttps = window.location.protocol === 'https:';

export const CONFIG = {
  // When HTTPS (served by Vite basic-ssl), use nginx for signaling (port 443)
  // When HTTP, connect directly to signaling server
  SERVER_URL: isHttps
    ? `https://${hostname}`
    : isLocalhost
      ? 'http://localhost:3001'
      : `http://${hostname}:3001`,
  BUILDING_ID: 'edificio-01',
  BUILDING_NAME: 'EDIFICIO PRINCIPAL',
  ADDRESS: 'Calle 123 #45-67, Bogotá',
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(isDev ? [TURN_SERVER] : []),
  ],
} as const;
