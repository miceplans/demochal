import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const drizzleDirectory = resolve(import.meta.dirname, '../../drizzle');
const journal = JSON.parse(
  readFileSync(resolve(drizzleDirectory, 'meta/_journal.json'), 'utf8'),
) as {
  entries: Array<{ tag: string }>;
};
const baselineTag = journal.entries[0]?.tag;

describe('baseline schema migration', () => {
  it('tracks and creates every table in the current core schema', () => {
    expect(journal.entries).toHaveLength(1);
    expect(baselineTag).toMatch(/^0000_/);

    const sql = readFileSync(resolve(drizzleDirectory, `${baselineTag}.sql`), 'utf8');

    for (const table of [
      'users',
      'businesses',
      'verifications',
      'challenges',
      'applications',
      'orders',
      'payments',
      'files',
      'notifications',
    ]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }

    expect(sql).toContain('CONSTRAINT "users_email_unique" UNIQUE("email")');
    expect(sql.match(/uuid PRIMARY KEY DEFAULT gen_random_uuid\(\) NOT NULL/g)).toHaveLength(9);
    expect(sql).toContain('"password_hash" text NOT NULL');
    expect(sql).toContain('"start_date" timestamp NOT NULL');
    expect(sql).toContain('"end_date" timestamp NOT NULL');
    expect(sql).toContain('"payload" jsonb NOT NULL');
    expect(sql).toContain('"provider_payment_key" varchar(200) NOT NULL');

    for (const foreignKey of [
      'applications_challenge_id_challenges_id_fk',
      'applications_user_id_users_id_fk',
      'businesses_owner_user_id_users_id_fk',
      'challenges_business_id_businesses_id_fk',
      'notifications_user_id_users_id_fk',
      'orders_application_id_applications_id_fk',
      'orders_user_id_users_id_fk',
      'payments_order_id_orders_id_fk',
      'verifications_business_id_businesses_id_fk',
    ]) {
      expect(sql).toContain(foreignKey);
    }
  });
});
