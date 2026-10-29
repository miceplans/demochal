import { config as loadDotenv } from 'dotenv';

// No-op when env vars are injected directly (e.g. the Docker Compose migrate
// service passes DATABASE_URL explicitly).
loadDotenv({ quiet: true });

export interface MigrationEnv {
  databaseUrl: string;
  databaseSslCaPath?: string;
}

// The migration entry point is intentionally restricted to DATABASE_URL only,
// so migration code resolves its own minimal env instead of importing the
// shared ./env.js config, which pulls in the full application secret set
// (JWT_SECRET, OAuth keys, ...) and throws when they are absent.
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
