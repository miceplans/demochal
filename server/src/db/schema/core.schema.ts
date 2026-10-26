import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
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
export type ApplicationFormQuestion = {
  id: string;
  title: string;
  type: 'dropdown' | 'checkbox' | 'radio' | 'file' | 'short' | 'long';
  options: string[];
  required: boolean;
};
export type ChallengeAttachment = { fileId: string; name: string; size: number };
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // A withdrawn account retains only this FK anchor; personal fields are erased.
    email: varchar('email', { length: 255 }).unique(),
    name: varchar('name', { length: 100 }),
    role: varchar('role', { length: 20 }).notNull().default('user'),
    passwordHash: text('password_hash'),
    googleSubject: varchar('google_subject', { length: 255 }).unique(),
    naverSubject: varchar('naver_subject', { length: 255 }).unique(),
    kakaoSubject: varchar('kakao_subject', { length: 255 }).unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    position: varchar('position', { length: 100 }),
    region: varchar('region', { length: 100 }),
    // 프로필 한 줄 소개(최대 100자). 비어 있으면 null.
    bio: varchar('bio', { length: 100 }),
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
    // 기업 회원가입(`/biz/login`)에서 받는 로그인 아이디 — 이메일 대신 로그인할 수 있다.
    username: varchar('username', { length: 50 }).unique(),
    phone: varchar('phone', { length: 30 }),
    // contact_verifications 인증 완료 시각 (null이면 미인증)
    emailVerifiedAt: timestamp('email_verified_at'),
    phoneVerifiedAt: timestamp('phone_verified_at'),
    // 약관 동의 기록: 약관 키(privacy | business) → 동의 시각(ISO)
    termsAgreements: jsonb('terms_agreements').$type<Record<string, string>>(),
    withdrawnAt: timestamp('withdrawn_at'),
    // 프로필 이미지: files.id (public 버킷, ready 상태). null이면 기본 아바타.
    profileImageFileId: uuid('profile_image_file_id'),
  },
  (table) => [
    // 로그인/가입 조회는 모두 lower(email)로 매칭하므로 중복 방지도 대소문자 무시 인덱스가 담당한다 —
    // 없으면 A@x.com / a@x.com 이 각각 가입된다.
    uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`),
  ],
);

/**
 * One TOTP secret per privileged account; encrypted at rest by the auth layer.
 * verifiedAt이 null이면 등록 확인(첫 코드 입력)을 기다리는 pending 상태다.
 */
export const userTotpCredentials = pgTable('user_totp_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  secretCiphertext: text('secret_ciphertext').notNull(),
  verifiedAt: timestamp('verified_at'),
  // 마지막으로 수락한 TOTP time-step(30초 단위). 같은 코드의 재사용을 막는다.
  lastUsedStep: bigint('last_used_step', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userPasskeyCredentials = pgTable(
  'user_passkey_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialId: text('credential_id').notNull().unique(),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    transports: jsonb('transports').$type<string[]>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('user_passkey_credentials_user_id_idx').on(table.userId)],
);

/** Only irreversible recovery-code digests are retained. */
export const userMfaRecoveryCodes = pgTable(
  'user_mfa_recovery_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull().unique(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('user_mfa_recovery_codes_user_id_idx').on(table.userId)],
);

// WebAuthn 단회 challenge. 등록(register)·로그인 인증(auth) 옵션 발급 시 저장하고
// 검증 성공 시 usedAt을 찍어 재사용을 막는다 — 만료·사용 여부를 DB에서 검증하므로
// 클라이언트가 날조한 challenge로는 통과할 수 없다.
export const userMfaChallenges = pgTable(
  'user_mfa_challenges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // webauthn-register | webauthn-auth
    type: varchar('type', { length: 20 }).notNull(),
    challenge: text('challenge').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
  },
  (table) => [index('user_mfa_challenges_user_id_idx').on(table.userId)],
);

export const businesses = pgTable('businesses', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id),
  // 가입 폼에서는 받지 않는다 — 사업자등록증 OCR 결과 또는 기업 프로필 편집으로 채운다.
  name: varchar('name', { length: 200 }),
  // 학교/비영리 등 사업자번호가 없는 기관은 null.
  registrationNumber: varchar('registration_number', { length: 20 }),
  // pending | verified | rejected ('approved'는 0021에서 verified로 정규화됨).
  // 기관은 가입 시 자동 승인(verified)되며, pending/rejected는 0040에서 모두 verified로 정리했다.
  verificationStatus: varchar('verification_status', { length: 20 }).notNull().default('verified'),
  // 가입 시 국세청 조회 결과: registered | unavailable(조회 장애). null = 조회 대상 아님(기업 외 유형)이거나 기존 가입.
  ntsResult: varchar('nts_result', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // 기관 유형: 기업 | 학교 | 비영리 | 협회
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
  // pending | processing | verified | rejected
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
  // 인원 제한 입력은 폼에서 제거됐다. null이면 정원 제한 없음(기존 공고는 값 유지).
  capacity: integer('capacity'),
  // 접수 기간(시각 포함). 행사 기간은 아래 eventStartDate/eventEndDate로 분리한다.
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  // 행사 기간. 둘 다 null이면 미정.
  eventStartDate: timestamp('event_start_date'),
  eventEndDate: timestamp('event_end_date'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // 관리자 콘텐츠 모니터링에서 '확인' 처리한 시각. 값이 있으면 '확인해야하는 챌린지' 목록에서 제외한다.
  adminReviewedAt: timestamp('admin_reviewed_at'),
  category: varchar('category', { length: 100 }),
  viewCount: integer('view_count').notNull().default(0),
  // Valid values: seMOchall | external. Challenges recruiting through the
  // in-service application form get an exposure boost in recommendations.
  recruitMethod: varchar('recruit_method', { length: 20 }).notNull().default('external'),
  // recruitMethod === 'external'일 때만 의미 있는 외부 지원 링크. seMOchall 공고에는 남기지 않는다.
  recruitUrl: varchar('recruit_url', { length: 2048 }),
  // 탐색 필터용 메타. 대상 유효값: 어린이 | 초등학생 | 중학생 | 고등학생 | 대학생 | 대학원생 |
  // 제한없음 | 지역제한 | 일반인 | 기업 (복수 선택).
  targets: text('targets').array(),
  // 주최기관 유형. 유효값: 중앙정부/기관 | 대기업 | 외국계기업 | 학교/재단/협회 | 학회/비영리단체 |
  // 진흥원 | 언론 | 지방자치단체 | 중소/벤처기업 | 기타
  organizerType: varchar('organizer_type', { length: 30 }),
  // 총상금(만원). null이면 상금 미정/없음.
  prizeAmount: integer('prize_amount'),
  // 챌린지 포스터. 파일이 제거되면 기존 공고는 placeholder를 표시한다.
  posterFileId: uuid('poster_file_id').references(() => files.id, { onDelete: 'set null' }),
  // 카드 썸네일용 — 업로더가 포스터에서 썸네일로 보일 영역을 잘라 만든 별도 파일.
  // null이면 카드는 posterUrl로 폰백한다(기존 공고 호환).
  thumbnailFileId: uuid('thumbnail_file_id').references(() => files.id, { onDelete: 'set null' }),
  // biz 콘솔 "신청서(질문지) 만들기" 화면에서 작성한 질문 목록. 별도 테이블 대신
  // 챌린지 레코드에 JSONB로 붙인다 — 질문 6종·순서·필수여부만 담는 단순 구조라
  // 정규화 테이블보다 jsonb.$type<>()가 적합하다(#264). 저장 전 없으면 null.
  applicationForm: jsonb('application_form').$type<ApplicationFormQuestion[]>(),
  // 주최(신규 공고는 필수 — 기존 공고 호환을 위해 DB는 nullable), 주관·협찬·후원(선택).
  host: varchar('host', { length: 200 }),
  supervisor: varchar('supervisor', { length: 200 }),
  sponsor: varchar('sponsor', { length: 200 }),
  supporter: varchar('supporter', { length: 200 }),
  // 대상에 '기타'를 고른 경우 직접 입력한 내용.
  targetOther: varchar('target_other', { length: 100 }),
  // 첨부파일. 개인 파일과 같이 private 버킷에만 두고 다운로드는 presigned GET으로만 연다.
  attachments: jsonb('attachments').$type<ChallengeAttachment[]>().notNull().default([]),
  summary: varchar('summary', { length: 300 }),
  hashtags: jsonb('hashtags').$type<string[]>().notNull().default([]),
  topics: jsonb('topics').$type<string[]>().notNull().default([]),
  inquiryContact: varchar('inquiry_contact', { length: 200 }),
  visibility: varchar('visibility', { length: 20 }).notNull().default('public'),
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
  // 모집글 작성 설문: 팀 소개(여러 줄) · 우대사항 · 기타. 모두 선택 입력.
  introduction: text('introduction'),
  preferred: varchar('preferred', { length: 200 }),
  etc: varchar('etc', { length: 200 }),
  status: varchar('status', { length: 20 }).notNull().default('recruiting'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // 관리자 콘텐츠 모니터링에서 '확인' 처리한 시각. 값이 있으면 '확인해야하는 팀' 목록에서 제외한다.
  adminReviewedAt: timestamp('admin_reviewed_at'),
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
  // pending=지원 대기(사용자→리더), invited=초대 대기(리더→사용자, 수락/거절은 본인), accepted/rejected=확정.
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // 결과 전송 시 팀장이 합격자에게 별도로 저장하는 채팅방 링크(불합격/미정이면 NULL)
  chatLink: varchar('chat_link', { length: 500 }),
  // 사람찾기 스카우트 제안(팀장→사용자)일 때만 채워진다. scoutedAt이 팀당 3회 제한의 집계 기준이다.
  scoutedAt: timestamp('scouted_at'),
  scoutMessage: varchar('scout_message', { length: 200 }),
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
  // 일시정지 주체: owner | admin. admin 정지는 기업이 재개할 수 없다. 정지 상태가 아니면 null.
  pausedBy: varchar('paused_by', { length: 10 }),
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
    // Valid values: ready | paid | canceled | expired | refund_pending
    // (charged but the order could not be settled and the compensating Toss cancel
    // failed — the worker retries the cancel with backoff via
    // PaymentsService.retryRefundPendingPayments, then operators refund manually).
    // Legacy rows can contain done | cancelled and are handled when reading
    // billing history.
    status: varchar('status', { length: 20 }).notNull().default('ready'),
    // Cumulative amount refunded via Toss PARTIAL_CANCELED reconciliation, set
    // from Toss's balanceAmount each time (never incremented) so a redelivered
    // webhook is idempotent. 0 for untouched/fully-paid rows; irrelevant once
    // status is 'canceled' (the full amount is already excluded from revenue).
    refundedAmount: integer('refunded_amount').notNull().default(0),
    approvedAt: timestamp('approved_at'),
    // Failed-refund retry bookkeeping for 'refund_pending' rows: how many Toss
    // cancel retries have been attempted and when the last one ran. The worker's
    // retryRefundPendingPayments scan backs off exponentially from refundRetriedAt
    // and stops retrying after a capped number of attempts, leaving the row —
    // still 'refund_pending' — for operators to refund manually.
    refundRetryCount: integer('refund_retry_count').notNull().default(0),
    refundRetriedAt: timestamp('refund_retried_at'),
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
  // 공고 포스터처럼 원본(JPG/PNG/WebP)을 변환 없이 공개 버킷에 올리는 파일. 그 외 공개 이미지는 WebP로 강제한다.
  preserveOriginal: boolean('preserve_original').notNull().default(false),
  uploaderUserId: uuid('uploader_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
// Outbox pattern: a DB transaction inserts its business row and an outbox row
// together, so an external side effect (SQS, webhook relay, ...) is never
// lost to a crash between the DB commit and the send. A poller (currently
// OutboxRelayService, driven from worker.ts) sends pending rows and marks
// them sent; status values: pending | sent | failed.
// 이메일/휴대폰 인증번호. 코드는 서버 비밀에서 HKDF로 파생한 키의 HMAC-SHA256으로만 저장한다.
export const contactVerifications = pgTable(
  'contact_verifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // email | phone
    channel: varchar('channel', { length: 10 }).notNull(),
    target: varchar('target', { length: 255 }).notNull(),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at').notNull(),
    verifiedAt: timestamp('verified_at'),
    // register에서 소비되면 기록 — 같은 인증을 두 계정에 재사용하지 못하게 한다.
    consumedAt: timestamp('consumed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('contact_verifications_target_idx').on(table.channel, table.target, table.createdAt),
  ],
);
export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  sentAt: timestamp('sent_at'),
});
// Email send state for the outbox-driven SES worker, keyed by the outbox event
// id (the idempotency key). The worker claims a row as 'sending' *before*
// calling SES, so concurrent/duplicate SQS deliveries of one event cannot both
// send; the row flips to 'sent' after SES accepts. A failed send deletes its
// claim, and a 'sending' claim older than the lease can be taken over after a
// worker crash.
export const emailSendStates = pgTable(
  'email_send_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    outboxEventId: uuid('outbox_event_id')
      .notNull()
      .references(() => outboxEvents.id),
    status: varchar('status', { length: 20 }).notNull(), // sending | sent
    claimedAt: timestamp('claimed_at').defaultNow().notNull(),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('email_send_states_outbox_event_id_unique').on(table.outboxEventId)],
);
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
// 빌링 인증(authKey) 교환 시도 기록 — 토스가 카드를 저장했지만 HTTP 응답이
// 사라진 경우에도 재시도가 중복 카드를 만들지 않고 저장된 카드를 돌려주기 위한
// 멱등 레코드다. 원본 one-time authKey는 절대 저장하지 않고 sha256 해시만 기록한다.
export const billingAuthAttempts = pgTable(
  'billing_auth_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    authKeyHash: varchar('auth_key_hash', { length: 64 }).notNull(),
    // 교환 성공 후 연결된 카드 — null이면 아직 교환 중이거나 실패한 시도다.
    cardId: uuid('card_id').references(() => paymentCards.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('billing_auth_attempts_auth_key_hash_unique').on(table.authKeyHash)],
);
