import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

type OpenRole = { role: string; count: number };
type ExternalLink = { label: string; url: string };
type AwardRecord = { title: string; organization: string; date: string; prize: string };
type ContentBlock = { type: string; content: Record<string, unknown> };

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  passwordHash: text('password_hash'),
  authProvider: varchar('auth_provider', { length: 20 }).notNull().default('local'),
  googleId: varchar('google_id', { length: 255 }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  position: varchar('position', { length: 100 }),
  region: varchar('region', { length: 100 }),
  stacks: jsonb('stacks').$type<string[]>().notNull().default([]),
  badges: jsonb('badges').$type<string[]>().notNull().default([]),
  externalLinks: jsonb('external_links').$type<ExternalLink[]>().notNull().default([]),
  awardHistory: jsonb('award_history').$type<AwardRecord[]>().notNull().default([]),
  onboardingSurvey: jsonb('onboarding_survey').$type<object | null>(),
  interests: jsonb('interests').$type<string[]>().notNull().default([]),
  notificationSettings: jsonb('notification_settings')
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  suspendedReason: text('suspended_reason'),
  suspendedAt: timestamp('suspended_at'),
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
  bannerImageFileId: uuid('banner_image_file_id'),
  logoImageFileId: uuid('logo_image_file_id'),
  address: varchar('address', { length: 300 }),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  contentBlocks: jsonb('content_blocks').$type<ContentBlock[]>().notNull().default([]),
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
  category: varchar('category', { length: 100 }),
  viewCount: integer('view_count').notNull().default(0),
});
export const challengeViews = pgTable('challenge_views', {
  id: uuid('id').defaultRandom().primaryKey(),
  challengeId: uuid('challenge_id')
    .notNull()
    .references(() => challenges.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  challengeId: uuid('challenge_id')
    .notNull()
    .references(() => challenges.id),
  leaderUserId: uuid('leader_user_id')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 200 }).notNull(),
  region: varchar('region', { length: 100 }),
  openRoles: jsonb('open_roles').$type<OpenRole[] | null>(),
  status: varchar('status', { length: 20 }).notNull().default('recruiting'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const teamMembers = pgTable('team_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  role: varchar('role', { length: 100 }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
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
  role: varchar('role', { length: 100 }),
  teammates: jsonb('teammates').$type<string[]>().notNull().default([]),
  evaluation: varchar('evaluation', { length: 20 }).notNull().default('undecided'),
  managerMemo: text('manager_memo'),
});
export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  challengeId: uuid('challenge_id')
    .notNull()
    .references(() => challenges.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const adProducts = pgTable('ad_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  placement: varchar('placement', { length: 20 }).notNull().unique(),
  dailyPrice: integer('daily_price').notNull(),
  previewImageUrl: text('preview_image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const ads = pgTable('ads', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id),
  productId: uuid('product_id')
    .notNull()
    .references(() => adProducts.id),
  title: varchar('title', { length: 200 }),
  imageFileId: uuid('image_file_id'),
  landingUrl: text('landing_url'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('preparing'),
  paidAmount: integer('paid_amount').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').references(() => applications.id),
  adId: uuid('ad_id').references(() => ads.id),
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
  providerPaymentKey: varchar('provider_payment_key', { length: 200 }).notNull(),
  amount: integer('amount').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ready'),
  approvedAt: timestamp('approved_at'),
});
export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  bucket: varchar('bucket', { length: 20 }).notNull(),
  key: text('key').notNull(),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  uploadStatus: varchar('upload_status', { length: 20 }).notNull().default('pending'),
  uploaderUserId: uuid('uploader_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const paymentCards = pgTable('payment_cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id),
  cardName: varchar('card_name', { length: 100 }),
  maskedNumber: varchar('masked_number', { length: 30 }).notNull(),
  billingKey: varchar('billing_key', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
