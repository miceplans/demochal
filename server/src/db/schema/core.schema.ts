import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

type OpenRole = { role: string; count: number };
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  passwordHash: text('password_hash'),
  googleSubject: varchar('google_subject', { length: 255 }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  position: varchar('position', { length: 100 }),
  region: varchar('region', { length: 100 }),
  stacks: jsonb('stacks').$type<string[]>().notNull().default([]),
  badges: jsonb('badges').$type<string[]>().notNull().default([]),
  externalLinks: jsonb('external_links').notNull().default([]),
  awardHistory: jsonb('award_history').notNull().default([]),
  onboardingSurvey: jsonb('onboarding_survey'),
  interests: jsonb('interests').$type<string[]>().notNull().default([]),
  notificationSettings: jsonb('notification_settings')
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
  suspended: boolean('suspended').notNull().default(false),
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
  type: varchar('type', { length: 50 }),
  bannerImageFileId: uuid('banner_image_file_id'),
  logoImageFileId: uuid('logo_image_file_id'),
  address: varchar('address', { length: 300 }),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  contentBlocks: jsonb('content_blocks').notNull().default([]),
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
  leaderRole: varchar('leader_role', { length: 50 }),
  region: varchar('region', { length: 100 }),
  openRoles: jsonb('open_roles').$type<OpenRole[]>().notNull().default([]),
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
  teammates: jsonb('teammates').notNull().default([]),
  formAnswers: jsonb('form_answers').notNull().default([]),
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
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  placement: varchar('placement', { length: 20 }).notNull(),
  dailyPrice: integer('daily_price').notNull(),
  previewImageUrl: text('preview_image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const ads = pgTable('ads', {
  id: uuid('id').defaultRandom().primaryKey(),
  adNumber: serial('ad_number').notNull(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id),
  productId: varchar('product_id', { length: 50 })
    .notNull()
    .references(() => adProducts.id),
  title: varchar('title', { length: 200 }).notNull(),
  imageFileId: uuid('image_file_id'),
  landingUrl: text('landing_url'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('preparing'),
  paidAmount: integer('paid_amount').notNull().default(0),
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
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    provider: varchar('provider', { length: 20 }).notNull().default('toss'),
    providerPaymentKey: varchar('provider_payment_key', { length: 200 }).notNull(),
    amount: integer('amount').notNull(),
    // Valid values: ready | paid | canceled | expired. Legacy rows can contain
    // done | cancelled and are handled when reading billing history.
    status: varchar('status', { length: 20 }).notNull().default('ready'),
    approvedAt: timestamp('approved_at'),
  },
  // One payment row per order: webhook handlers upsert on order_id so that
  // concurrent Toss deliveries for the same order conflict instead of
  // duplicating rows.
  (table) => [uniqueIndex('payments_order_id_unique').on(table.orderId)],
);
export const files = pgTable('files', {
  id: uuid('id').defaultRandom().primaryKey(),
  bucket: varchar('bucket', { length: 20 }).notNull(),
  requestedBucket: varchar('requested_bucket', { length: 20 }).notNull(),
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
  billingKey: text('billing_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
