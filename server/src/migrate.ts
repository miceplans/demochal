import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { resolveMigrationEnv } from './config/migration-env.js';
import { createPoolOptions } from './db/pool-options.js';

// One-off migration entry point — `node dist/migrate.js`. Run by the local
// Docker Compose `migrate` service (see root docker-compose.yml) once the db
// service is healthy; the `api`/`worker` services only start after this task
// completes successfully. Never invoked automatically by main.ts/worker.ts on
// boot (see root CLAUDE.md, server/ rules).
//
// Uses drizzle-orm's programmatic migrator (a production dependency) instead
// of shelling out to the drizzle-kit CLI, since drizzle-kit is a devDependency
// and is not present in the runtime image (server/Dockerfile.api runs
// `pnpm deploy --prod`).
async function run() {
  const logger = new Logger('Migrate');
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  const migrationEnv = resolveMigrationEnv();
  const pool = new Pool(
    createPoolOptions(migrationEnv.databaseUrl, migrationEnv.databaseSslCaPath),
  );
  try {
    const db = drizzle(pool);
    logger.log(`Applying pending migrations from ${migrationsFolder}...`);
    await migrate(db, { migrationsFolder });
    logger.log('Migrations applied successfully.');
  } finally {
    await pool.end();
  }
}

try {
  await run();
} catch (error) {
  new Logger('Migrate').error('Migration failed', error);
  process.exitCode = 1;
}
