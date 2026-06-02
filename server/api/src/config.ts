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
