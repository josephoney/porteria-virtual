const isDev = window.location.protocol === 'file:' || window.location.hostname === 'localhost';

export const CONFIG = {
  SERVER_URL: isDev ? 'http://localhost:3001' : window.location.origin,
  BUILDING_ID: 'edificio-01',
  BUILDING_NAME: 'EDIFICIO PRINCIPAL',
  ADDRESS: 'Calle 123 #45-67, Bogotá',
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
} as const;
