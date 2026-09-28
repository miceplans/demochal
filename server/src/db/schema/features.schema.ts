import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { ads, users } from './core.schema.js';
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const inquiries = pgTable('inquiries', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  contact: varchar('contact', { length: 200 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const certificates = pgTable('certificates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 300 }).notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  fileId: uuid('file_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: varchar('content', { length: 300 }).notNull(),
  targetType: varchar('target_type', { length: 20 }).notNull(), // challenge | team | award | user
  targetId: uuid('target_id'),
  org: varchar('org', { length: 200 }),
  summary: varchar('summary', { length: 300 }).notNull(),
  detail: text('detail'),
  reporterUserId: uuid('reporter_user_id').references(() => users.id),
  reporterName: varchar('reporter_name', { length: 100 }),
  reportedUserId: uuid('reported_user_id').references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  note: text('note'),
  resolutionNote: text('resolution_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reportedAt: timestamp('reported_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});
export const adminSettings = pgTable('admin_settings', {
  id: varchar('id', { length: 20 }).primaryKey(),
  values: jsonb('values').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 광고 이벤트는 개인정보 없이 광고별 서울 시간 기준 시간 버킷 카운터로만 저장한다.
// 동일 버킷의 노출/클릭을 한 행에 upsert해 원본 이벤트가 무한히 쌓이지 않도록 한다.
export const adEventCounters = pgTable(
  'ad_event_counters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adId: uuid('ad_id')
      .notNull()
      .references(() => ads.id),
    bucketStart: timestamp('bucket_start').notNull(),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('ad_event_counters_ad_bucket_unique').on(table.adId, table.bucketStart)],
);
