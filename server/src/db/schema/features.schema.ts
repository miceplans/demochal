import { jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { files, users } from './core.schema.js';
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const inquiries = pgTable('inquiries', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  contact: varchar('contact', { length: 255 }).notNull(),
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
  fileId: uuid('file_id')
    .notNull()
    .references(() => files.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: varchar('content', { length: 300 }).notNull(),
  targetType: varchar('target_type', { length: 20 }).notNull(),
  org: varchar('org', { length: 200 }).notNull(),
  summary: varchar('summary', { length: 300 }).notNull(),
  detail: text('detail').notNull(),
  reporterUserId: uuid('reporter_user_id').references(() => users.id),
  reporterName: varchar('reporter_name', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});
export const adminSettings = pgTable('admin_settings', {
  id: varchar('id', { length: 20 }).primaryKey().default('default'),
  values: jsonb('values').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
