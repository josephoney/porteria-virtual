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

export const CONFIG = {
  API_URL: isDev
    ? isLocalhost
      ? 'http://localhost:3000'
      : `http://${hostname}:3000`
    : window.location.origin,
  SIGNALING_URL: isDev
    ? isLocalhost
      ? 'http://localhost:3001'
      : `http://${hostname}:3001`
    : window.location.origin,
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...(isDev ? [TURN_SERVER] : []),
  ],
} as const;
