import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'porteria',
    user: process.env.POSTGRES_USER || 'porteria',
    password: process.env.POSTGRES_PASSWORD || 'porteria_dev',
    ssl: false,
  },
});
