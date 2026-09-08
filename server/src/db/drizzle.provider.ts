import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

export const DRIZZLE = Symbol('DRIZZLE');

// pg.Pool connects lazily on first query, so constructing it here does not
// require the database to be reachable at process startup.
export function createDatabase(): Database {
  const pool = new Pool({ connectionString: env.databaseUrl });
  return drizzle(pool, { schema });
}
