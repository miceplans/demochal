import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// TODO: split into per-module schema files once tables outgrow this skeleton.

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'), // user | business | admin
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const businesses = pgTable('businesses', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 200 }).notNull(),
  registrationNumber: varchar('registration_number', { length: 20 }).notNull(),
  verificationStatus: varchar('verification_status', { length: 20 }).notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const verifications = pgTable('verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id),
  documentFileId: uuid('document_file_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  ocrResult: jsonb('ocr_result'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const challenges = pgTable('challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  capacity: integer('capacity').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const applications = pgTable('applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  challengeId: uuid('challenge_id')
    .notNull()
    .references(() => challenges.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id')
    .notNull()
    .references(() => applications.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  amount: integer('amount').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id),
  provider: varchar('provider', { length: 20 }).notNull().default('toss'),
  providerPaymentKey: varchar('provider_payment_key', {
    length: 200,
  }).notNull(),
  amount: integer('amount').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ready'),
  approvedAt: timestamp('approved_at'),
});

export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  bucket: varchar('bucket', { length: 20 }).notNull(), // public | private
  key: text('key').notNull(),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
