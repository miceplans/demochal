import {
  integer,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { ads, users } from './core.schema.js';
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: varchar('type', { length: 50 }).notNull(),
    payload: jsonb('payload').notNull(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    // 스케줄러가 만드는 알림(마감/공고)의 중복 방지 키. null이면 중복 제어 없음(팀매칭 등).
    dedupeKey: varchar('dedupe_key', { length: 100 }),
  },
  (table) => [uniqueIndex('notifications_user_dedupe_key_idx').on(table.userId, table.dedupeKey)],
);
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

// Support mailbox foundation. Bodies and original MIME remain separate so the
// inbound processor can persist metadata first and the admin inbox can later
// choose whether to render the sanitized text/html body or fetch the MIME.
export const emailThreads = pgTable(
  'email_threads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subject: varchar('subject', { length: 998 }),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('email_threads_updated_at_idx').on(table.updatedAt)],
);

export const emailMessages = pgTable(
  'email_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => emailThreads.id),
    direction: varchar('direction', { length: 10 }).notNull(), // INBOUND | OUTBOUND
    messageId: varchar('message_id', { length: 998 }),
    sesMessageId: varchar('ses_message_id', { length: 256 }),
    inReplyTo: varchar('in_reply_to', { length: 998 }),
    references: text('references'),
    fromAddress: varchar('from_address', { length: 998 }).notNull(),
    toAddresses: jsonb('to_addresses').$type<string[]>().notNull().default([]),
    ccAddresses: jsonb('cc_addresses').$type<string[]>().notNull().default([]),
    subject: varchar('subject', { length: 998 }),
    textBody: text('text_body'),
    htmlBody: text('html_body'),
    s3ObjectKey: text('s3_object_key'),
    deliveryStatus: varchar('delivery_status', { length: 20 }).notNull().default('SENT'),
    sentAt: timestamp('sent_at'),
    receivedAt: timestamp('received_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('email_messages_message_id_unique').on(table.messageId),
    uniqueIndex('email_messages_ses_message_id_unique').on(table.sesMessageId),
    index('email_messages_thread_created_at_idx').on(table.threadId, table.createdAt),
    index('email_messages_in_reply_to_idx').on(table.inReplyTo),
  ],
);

export const emailAttachments = pgTable(
  'email_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => emailMessages.id),
    filename: varchar('filename', { length: 255 }),
    contentType: varchar('content_type', { length: 255 }).notNull(),
    sizeBytes: integer('size_bytes'),
    contentId: varchar('content_id', { length: 998 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('email_attachments_message_id_idx').on(table.messageId)],
);

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
