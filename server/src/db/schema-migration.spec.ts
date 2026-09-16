import { readFileSync, readdirSync } from 'node:fs';
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
    expect(journal.entries).toHaveLength(7);
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

describe('0005_reconcile_auth_reports migration', () => {
  it('adds the OAuth and report contract without destructive DDL', () => {
    const tag = journal.entries[5]?.tag;
    expect(tag).toBe('0005_reconcile_auth_reports');
    const sql = readFileSync(resolve(drizzleDirectory, `${tag}.sql`), 'utf8');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "google_subject"');
    expect(sql).toContain('ALTER COLUMN "password_hash" DROP NOT NULL');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "target_id"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "reported_user_id"');
    expect(sql).not.toMatch(/DROP (?:TABLE|COLUMN)/);
  });
});

describe('0001_add_google_auth migration', () => {
  it('adds social-login columns to users', () => {
    const tag = journal.entries[1]?.tag;
    expect(tag).toMatch(/^0001_/);

    const sql = readFileSync(resolve(drizzleDirectory, `${tag}.sql`), 'utf8');

    expect(sql).toContain('ALTER TABLE "users" ADD COLUMN "auth_provider" varchar(20)');
    expect(sql).toContain('ALTER TABLE "users" ADD COLUMN "google_id" varchar(255)');
    expect(sql).toContain('ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL');
    expect(sql).toContain('CONSTRAINT "users_google_id_unique" UNIQUE("google_id")');
  });
});

describe('0002_add_ads migration', () => {
  it('creates the ad_products and ads tables', () => {
    const tag = journal.entries[2]?.tag;
    expect(tag).toMatch(/^0002_/);

    const sql = readFileSync(resolve(drizzleDirectory, `${tag}.sql`), 'utf8');

    expect(sql).toContain('CREATE TABLE "ad_products"');
    expect(sql).toContain('CREATE TABLE "ads"');
    expect(sql).toContain('ads_business_id_businesses_id_fk');
    expect(sql).toContain('ads_product_id_ad_products_id_fk');
  });
});

describe('0003_ads_fixes migration', () => {
  it('adds ad reservation expiry and a one-product-per-placement constraint', () => {
    const tag = journal.entries[3]?.tag;
    expect(tag).toMatch(/^0003_/);

    const sql = readFileSync(resolve(drizzleDirectory, `${tag}.sql`), 'utf8');

    expect(sql).toContain('ALTER TABLE "ads" ADD COLUMN "expires_at" timestamp');
    expect(sql).toContain('ad_products_placement_unique');
  });
});

describe('0004 platform extension migration', () => {
  it('creates the engagement/biz/admin tables and widens orders and profiles', () => {
    const tag = journal.entries[4]?.tag;
    expect(tag).toMatch(/^0004_/);

    const sql = readFileSync(resolve(drizzleDirectory, `${tag}.sql`), 'utf8');

    for (const table of [
      'teams',
      'team_members',
      'bookmarks',
      'payment_cards',
      'inquiries',
      'certificates',
      'reports',
      'admin_settings',
    ]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }

    expect(sql).toContain('ALTER TABLE "orders" ALTER COLUMN "application_id" DROP NOT NULL');
    expect(sql).toContain('ALTER TABLE "orders" ADD COLUMN "ad_id" uuid');
    expect(sql).toContain('ALTER TABLE "challenges" ADD COLUMN "category" varchar(100)');
    expect(sql).toContain('ALTER TABLE "challenges" ADD COLUMN "view_count" integer DEFAULT 0');
    expect(sql).toContain('ALTER TABLE "users" ADD COLUMN "onboarding_survey" jsonb');
    expect(sql).toContain('CONSTRAINT "bookmarks_user_id_challenge_id_unique"');
    expect(sql).toContain('CONSTRAINT "team_members_team_id_user_id_unique"');
    expect(sql).toContain('orders_ad_id_ads_id_fk');
  });
});

describe('migration chain coverage', () => {
  it('creates every table declared in the ORM schema across the whole chain', () => {
    const chainSql = journal.entries
      .map((entry) => readFileSync(resolve(drizzleDirectory, `${entry.tag}.sql`), 'utf8'))
      .join('\n');

    for (const table of [
      'users',
      'businesses',
      'verifications',
      'challenges',
      'challenge_views',
      'applications',
      'orders',
      'payments',
      'files',
      'notifications',
      'ad_products',
      'ads',
      'teams',
      'team_members',
      'bookmarks',
      'payment_cards',
      'inquiries',
      'certificates',
      'reports',
      'admin_settings',
    ]) {
      expect(chainSql).toMatch(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?"${table}"`));
    }
  });

  it('has no orphan migration files outside the journal chain', () => {
    const sqlFiles = readdirSync(drizzleDirectory).filter((file) => file.endsWith('.sql'));
    const journalTags = new Set(journal.entries.map((entry) => `${entry.tag}.sql`));
    expect(sqlFiles.sort()).toEqual([...journalTags].sort());
  });
});

describe('0006_schema_contract_completion migration', () => {
  it('closes the remaining ORM contract gaps without destructive DDL', () => {
    const tag = journal.entries[6]?.tag;
    expect(tag).toBe('0006_schema_contract_completion');

    const sql = readFileSync(resolve(drizzleDirectory, `${tag}.sql`), 'utf8');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "suspended" boolean');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "requested_bucket" varchar(20)');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "challenge_views"');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "challenge_views_challenge_id_idx"');
    expect(sql).toContain('ALTER TABLE "ad_products" ALTER COLUMN "id" TYPE varchar(50)');
    expect(sql).toContain('ALTER TABLE "ads" ALTER COLUMN "product_id" TYPE varchar(50)');
    expect(sql).not.toMatch(/DROP TABLE/);
    expect(sql).not.toMatch(/DROP COLUMN/);
  });
});
