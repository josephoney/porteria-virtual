import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';

export function createDb(databaseUrl?: string) {
  const pool = new Pool(
    databaseUrl
      ? { connectionString: databaseUrl }
      : {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
          database: process.env.POSTGRES_DB || 'porteria',
          user: process.env.POSTGRES_USER || 'porteria',
          password: process.env.POSTGRES_PASSWORD || 'porteria_dev',
        },
  );

  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDb>;
