import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { env } from './config/env.js';

// One-off migration entry point — `node dist/migrate.js`. Run manually via
// `aws ecs run-task` against the "migrate" task definition (see
// infra/terraform/compute.tf and infra/README.md), never invoked
// automatically by main.ts/worker.ts on boot, per this repo's manual
// migration convention (see root CLAUDE.md, server/ rules: migrations are
// generated with drizzle-kit but applied manually).
//
// Uses drizzle-orm's programmatic migrator (a production dependency) instead
// of shelling out to the drizzle-kit CLI, since drizzle-kit is a devDependency
// and is not present in the deployed image (server/Dockerfile.api runs
// `pnpm deploy --prod`).
async function run() {
  const logger = new Logger('Migrate');
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  const pool = new Pool({ connectionString: env.databaseUrl });
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
