import { describe, expect, it } from 'vitest';
import { resolveMigrationEnv } from './migration-env.js';

describe('resolveMigrationEnv', () => {
  it('resolves DATABASE_URL and the optional SSL CA path', () => {
    expect(
      resolveMigrationEnv({
        DATABASE_URL: 'postgres://app@db.example.amazonaws.com:5432/semochal',
        DATABASE_SSL_CA_PATH: '/app/certs/global-bundle.pem',
      }),
    ).toEqual({
      databaseUrl: 'postgres://app@db.example.amazonaws.com:5432/semochal',
      databaseSslCaPath: '/app/certs/global-bundle.pem',
    });
  });

  it('treats an empty SSL CA path as unset', () => {
    expect(
      resolveMigrationEnv({
        DATABASE_URL: 'postgres://app@db.example.amazonaws.com:5432/semochal',
        DATABASE_SSL_CA_PATH: '',
      }),
    ).toEqual({
      databaseUrl: 'postgres://app@db.example.amazonaws.com:5432/semochal',
      databaseSslCaPath: undefined,
    });
  });

  it.each([{}, { DATABASE_URL: '' }])(
    'throws a clear error when DATABASE_URL is missing (%o)',
    (source) => {
      expect(() => resolveMigrationEnv(source)).toThrow(
        'DATABASE_URL must be set to run migrations',
      );
    },
  );
});
