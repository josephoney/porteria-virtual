const config = {
  port: parseInt(process.env.API_PORT || '3000', 10),
  host: process.env.API_HOST || '0.0.0.0',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    accessExpiresIn: '15m',
    refreshExpiresInMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'porteria',
    user: process.env.POSTGRES_USER || 'porteria',
    password: process.env.POSTGRES_PASSWORD || 'porteria_dev',
  },

  internalApiKey: process.env.INTERNAL_API_KEY || 'dev-internal-key-change-me',
  mqttBridgeUrl: process.env.MQTT_BRIDGE_URL || 'http://localhost:3002',
  publicAppUrl: process.env.PUBLIC_APP_URL || 'http://localhost:5174',
  invitationExpiryDays: parseInt(process.env.INVITATION_EXPIRY_DAYS || '7', 10),
  features: {
    configurableLocationHierarchy: process.env.CONFIGURABLE_LOCATION_HIERARCHY !== 'false',
  },
  outbox: {
    workerEnabled: process.env.OUTBOX_WORKER_ENABLED !== 'false',
    batchSize: parseInt(process.env.OUTBOX_BATCH_SIZE || '50', 10),
    pollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '1000', 10),
    maxAttempts: parseInt(process.env.OUTBOX_MAX_ATTEMPTS || '10', 10),
    retentionDays: parseInt(process.env.OUTBOX_RETENTION_DAYS || '7', 10),
    lagWarnSeconds: parseInt(process.env.OUTBOX_LAG_WARN_SECONDS || '60', 10),
  },
} as const;

export function validateConfig() {
  const errors: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me') {
    errors.push('JWT_SECRET is not set or using default value');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === 'dev-refresh-secret-change-me') {
    errors.push('JWT_REFRESH_SECRET is not set or using default value');
  }
  return errors;
}

export default config;
