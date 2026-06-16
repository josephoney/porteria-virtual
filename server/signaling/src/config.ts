export const config = {
  PORT: parseInt(process.env.SIGNALING_PORT || '3001', 10),
  HOST: process.env.SIGNALING_HOST || '0.0.0.0',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  CALL_TIMEOUT_MS: 30_000,
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || 'dev-internal-key-change-me',
} as const;
