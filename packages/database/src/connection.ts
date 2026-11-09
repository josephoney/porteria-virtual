import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';

function buildDb(databaseUrl?: string) {
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

export type Database = ReturnType<typeof buildDb>;

/**
 * `createDb()` is called at module scope from ~30 route/service/plugin files.
 * Without memoization each module created its own pg.Pool (default max 10),
 * so a single API process could open hundreds of connections and exhaust
 * Postgres `max_connections`. Keep one pool per connection target instead.
 */
const databases = new Map<string, Database>();

export function createDb(databaseUrl?: string): Database {
  const key = databaseUrl ?? '__default__';
  let db = databases.get(key);

  if (!db) {
    db = buildDb(databaseUrl);
    databases.set(key, db);
  }

  return db;
}
