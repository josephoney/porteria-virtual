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
    dynamicQrEnabled: process.env.DYNAMIC_QR_ENABLED === 'true',
  },
  passes: {
    passWebUrl: process.env.PASS_WEB_URL || 'http://localhost:5176',
    qrSecret: process.env.PASS_QR_SECRET || 'dev-pass-qr-secret-change-me',
    qrTtlSeconds: parseInt(process.env.PASS_QR_TTL_SECONDS || '24', 10),
    linkTtlMinutes: parseInt(process.env.PASS_LINK_TTL_MINUTES || '1440', 10),
    pinAttempts: parseInt(process.env.PASS_PIN_ATTEMPTS || '5', 10),
    pinLockMinutes: parseInt(process.env.PASS_PIN_LOCK_MINUTES || '15', 10),
    scanPendingTtlSeconds: parseInt(process.env.PASS_SCAN_PENDING_TTL_SECONDS || '120', 10),
    missingExitGraceMinutes: parseInt(process.env.PASS_MISSING_EXIT_GRACE_MINUTES || '15', 10),
    dailyLimitPerUnit: parseInt(process.env.PASS_DAILY_LIMIT_PER_UNIT || '20', 10),
    rateLimits: {
      previewPerMinute: parseInt(process.env.PASS_RATE_LIMIT_PREVIEW || '60', 10),
      bindPerMinute: parseInt(process.env.PASS_RATE_LIMIT_BIND || '20', 10),
      qrPerMinute: parseInt(process.env.PASS_RATE_LIMIT_QR || '60', 10),
      statusPerMinute: parseInt(process.env.PASS_RATE_LIMIT_STATUS || '120', 10),
    },
  },
  guardShifts: {
    maxHours: parseInt(process.env.GUARD_SHIFT_MAX_HOURS || '16', 10),
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
  if (
    !process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_REFRESH_SECRET === 'dev-refresh-secret-change-me'
  ) {
    errors.push('JWT_REFRESH_SECRET is not set or using default value');
  }
  if (
    config.features.dynamicQrEnabled &&
    (!process.env.PASS_QR_SECRET || process.env.PASS_QR_SECRET === 'dev-pass-qr-secret-change-me')
  ) {
    errors.push('PASS_QR_SECRET is not set or using default value');
  }
  return errors;
}

export default config;
