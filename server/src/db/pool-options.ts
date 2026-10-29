import { readFileSync } from 'node:fs';
import type { PoolConfig } from 'pg';

type ReadCaFile = (path: string) => string;

const SSL_QUERY_PARAMETER_PREFIX = 'ssl';

function assertNoSslUrlParameters(databaseUrl: string): void {
  const url = new URL(databaseUrl);
  const sslParameters = [...url.searchParams.keys()].filter((key) =>
    key.toLowerCase().startsWith(SSL_QUERY_PARAMETER_PREFIX),
  );

  if (sslParameters.length > 0) {
    throw new Error(
      'DATABASE_URL must not include SSL query parameters; configure TLS with DATABASE_SSL_CA_PATH instead.',
    );
  }
}

/**
 * Builds the single PostgreSQL connection policy used by application and
 * migration clients. DATABASE_SSL_CA_PATH optionally points to a CA bundle
 * for TLS server-certificate verification against a managed Postgres. Local
 * Docker development leaves it unset and continues to use its non-TLS
 * PostgreSQL container.
 */
export function createPoolOptions(
  databaseUrl: string,
  databaseSslCaPath: string | undefined,
  readCaFile: ReadCaFile = (path) => readFileSync(path, 'utf8'),
): PoolConfig {
  if (!databaseSslCaPath) {
    return { connectionString: databaseUrl };
  }

  assertNoSslUrlParameters(databaseUrl);

  return {
    connectionString: databaseUrl,
    ssl: {
      ca: readCaFile(databaseSslCaPath),
      rejectUnauthorized: true,
    },
  };
}
