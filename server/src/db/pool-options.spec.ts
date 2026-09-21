import { describe, expect, it, vi } from 'vitest';
import { createPoolOptions } from './pool-options.js';

const databaseUrl = 'postgresql://app@db.example.amazonaws.com:5432/semochal';

describe('createPoolOptions', () => {
  it('uses the configured CA bundle and validates the server certificate', () => {
    const readCaFile = vi.fn(() => 'AWS RDS CA bundle');

    expect(createPoolOptions(databaseUrl, '/app/certs/global-bundle.pem', readCaFile)).toEqual({
      connectionString: databaseUrl,
      ssl: {
        ca: 'AWS RDS CA bundle',
        rejectUnauthorized: true,
      },
    });
    expect(readCaFile).toHaveBeenCalledWith('/app/certs/global-bundle.pem');
  });

  it('keeps local Docker development non-TLS when no CA path is configured', () => {
    expect(createPoolOptions('postgres://semochal:semochal@db:5432/semochal', undefined)).toEqual({
      connectionString: 'postgres://semochal:semochal@db:5432/semochal',
    });
  });

  it.each(['sslmode=require', 'sslrootcert=/tmp/other-ca.pem', 'SSLMODE=require'])(
    'rejects SSL connection-string option %s so it cannot override code policy',
    (sslParameter) => {
      expect(() => createPoolOptions(`${databaseUrl}?${sslParameter}`, undefined)).toThrow(
        'DATABASE_URL must not include SSL query parameters',
      );
    },
  );

  it('fails closed when the configured CA bundle cannot be read', () => {
    const readCaFile = vi.fn(() => {
      throw new Error('CA bundle is unavailable');
    });

    expect(() =>
      createPoolOptions(databaseUrl, '/app/certs/global-bundle.pem', readCaFile),
    ).toThrow('CA bundle is unavailable');
  });
});
