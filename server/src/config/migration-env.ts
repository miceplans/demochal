import { config as loadDotenv } from 'dotenv';

// No-op in production (the ECS migration task injects env vars directly).
loadDotenv({ quiet: true });

export interface MigrationEnv {
  databaseUrl: string;
  databaseSslCaPath?: string;
}

// The one-off ECS migration task is intentionally restricted to DATABASE_URL
// only (see migrate_secrets in infra/terraform/compute.tf), so migration code
// must resolve its own minimal env instead of importing the shared ./env.js
// config, which requires the full production secret set (JWT_SECRET, OAuth
// keys, ...) and throws when they are absent.
export function resolveMigrationEnv(source: NodeJS.ProcessEnv = process.env): MigrationEnv {
  const databaseUrl = source.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set to run migrations');
  }
  return {
    databaseUrl,
    databaseSslCaPath: source.DATABASE_SSL_CA_PATH || undefined,
  };
}
