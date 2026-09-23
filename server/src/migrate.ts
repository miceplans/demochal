import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { env } from './config/env.js';
import { createPoolOptions } from './db/pool-options.js';

// One-off migration entry point — `node dist/migrate.js`. Normally run by the
// CI deploy (`.github/workflows/ci.yml`): after GitHub Environment `production`
// approval it runs the "migrate" ECS task definition (see
// infra/terraform/compute.tf) and only updates the API/worker services once
// this task exits 0. A manual `aws ecs run-task` is only for the initial
// bootstrap in infra/README.md. Never invoked automatically by
// main.ts/worker.ts on boot (see root CLAUDE.md, server/ rules).
//
// Uses drizzle-orm's programmatic migrator (a production dependency) instead
// of shelling out to the drizzle-kit CLI, since drizzle-kit is a devDependency
// and is not present in the deployed image (server/Dockerfile.api runs
// `pnpm deploy --prod`).
async function run() {
  const logger = new Logger('Migrate');
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  const pool = new Pool(createPoolOptions(env.databaseUrl, env.databaseSslCaPath));
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
