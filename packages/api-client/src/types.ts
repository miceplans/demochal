// Shared domain types between front/ and server/.
// TODO: replace with OpenAPI-generated types once server exposes /openapi.json
// (see packages/api-client/README.md for the planned codegen step).

export type Role = 'user' | 'business' | 'admin';

export interface ExternalLink {
  label: string;
  url: string;
}

export interface AwardRecord {
  title: string;
  organization: string;
  date: string;
  prize: string;
}

export interface OnboardingSurvey {
  isActive?: boolean;
  interests?: string[];
  purposes?: string[];
  challengeTypes?: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  position?: string | null;
  region?: string | null;
  stacks: string[];
  badges: string[];
  externalLinks: ExternalLink[];
  awardHistory: AwardRecord[];
  onboardingSurvey?: OnboardingSurvey | null;
}

export interface UpdateProfileRequest {
  name?: string;
  /** Profile position (기획/디자인/개발 등) — not the account role. */
  role?: string;
  region?: string;
  stacks?: string[];
  externalLinks?: ExternalLink[];
  awardHistory?: AwardRecord[];
}

export interface ContentBlock {
  type: 'link' | 'text' | 'file' | 'layout' | 'image';
  content: Record<string, unknown>;
}

export interface Business {
  id: string;
  ownerUserId: string;
  name: string;
  registrationNumber: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  bannerImageFileId?: string | null;
  logoImageFileId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  contentBlocks: ContentBlock[];
}

export interface UpdateBusinessRequest {
  name?: string;
  bannerImageFileId?: string;
  logoImageFileId?: string;
  address?: string;
  phone?: string;
  email?: string;
  contentBlocks?: ContentBlock[];
}

export interface Verification {
  id: string;
  businessId: string;
  documentFileId: string;
  status: 'pending' | 'processing' | 'verified' | 'approved' | 'rejected';
  ocrResult?: Record<string, unknown>;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Challenge {
  id: string;
  businessId: string;
  title: string;
  description: string;
  price: number;
  capacity: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'published' | 'closed';
  createdAt: string;
  category?: string | null;
}

export interface StatWithDelta {
  value: number;
  deltaPercent: number;
}

export interface LabelValue {
  label: string;
  value: number;
}

export interface ChallengeStats {
  clicks: StatWithDelta;
  bookmarks: StatWithDelta;
  /** Reuses the click/view signal — no separate card-impression beacon exists yet. */
  exposure: StatWithDelta;
  applicantDistribution: LabelValue[];
  monthlyExposure: LabelValue[];
}

export interface Application {
  id: string;
  challengeId: string;
  userId: string;
  status: 'pending' | 'submitted' | 'reviewing' | 'needs_revision' | 'accepted' | 'rejected';
  createdAt: string;
  role?: string | null;
  teammates: string[];
  evaluation: 'undecided' | 'pass' | 'fail';
  managerMemo?: string | null;
}

export interface ApplyChallengeRequest {
  challengeId: string;
  role?: string;
  teammates?: string[];
  formAnswers?: Record<string, unknown>[];
}

export interface UpdateApplicationRequest {
  status?: 'submitted' | 'reviewing' | 'needs_revision' | 'accepted' | 'rejected';
  evaluation?: 'undecided' | 'pass' | 'fail';
  managerMemo?: string;
}

export interface TeamRoleSlot {
  role: string;
  count: number;
}

export interface Team {
  id: string;
  challengeId: string;
  leaderUserId: string;
  title: string;
  region?: string | null;
  openRoles: TeamRoleSlot[];
  status: 'recruiting' | 'closed';
  createdAt: string;
}

export interface CreateTeamRequest {
  challengeId: string;
  title: string;
  openRoles?: TeamRoleSlot[];
  myRole: string;
  region?: string;
}

export interface Order {
  id: string;
  /** Exactly one of applicationId/adId is set. */
  applicationId?: string | null;
  adId?: string | null;
  userId: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  createdAt: string;
}

export interface AdProduct {
  reservedPeriods?: { startDate: string; endDate: string }[];
  id: string;
  name: string;
  description?: string | null;
  placement: 'hero' | 'gallery' | 'team';
  dailyPrice: number;
  previewImageUrl?: string | null;
}

export interface Ad {
  id: string;
  businessId: string;
  productId: string;
  title: string;
  imageFileId?: string | null;
  landingUrl?: string | null;
  startDate: string;
  endDate: string;
  status: 'active' | 'preparing' | 'paused' | 'ended';
  paidAmount: number;
  createdAt: string;
}

export interface CreateAdRequest {
  expectedDailyPrice?: number;
  productId: string;
  imageFileId?: string;
  landingUrl?: string;
  startDate: string;
  endDate: string;
  title?: string;
}

export interface MetricTotals {
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface HourlyMetric {
  hour: number;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface AdReport {
  totals: MetricTotals;
  daily: DailyMetric[];
  hourly: HourlyMetric[];
  monthlyClicks: LabelValue[];
}

export interface PaymentCard {
  id: string;
  cardName?: string | null;
  maskedNumber: string;
}

export interface RegisterPaymentCardRequest {
  billingKey: string;
  cardName?: string;
  /** From Toss's billing-key-issue response — the server never sees a raw card number. */
  maskedNumber: string;
}

export interface PaymentHistoryItem {
  id: string;
  name: string;
  amount: number;
  paidAt: string;
  status: 'paid' | 'refunded' | 'failed';
}

export interface BizDashboard {
  recentPosting: Challenge | null;
  stats: ChallengeStats | null;
  monthlyAdExposure: LabelValue[];
  payments: PaymentHistoryItem[];
  paymentTotal: number;
  activeAds: Ad[];
}

export interface Payment {
  id: string;
  orderId: string;
  provider: 'toss';
  providerPaymentKey: string;
  amount: number;
  status: 'ready' | 'done' | 'cancelled' | 'failed';
  approvedAt?: string;
}

export interface FileObject {
  id: string;
  bucket: 'public' | 'private';
  key: string;
  contentType: string;
  uploadStatus: 'pending' | 'ready' | 'rejected';
  uploaderUserId?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PresignedUploadRequest {
  bucket: 'public' | 'private';
  contentType: string;
  fileName: string;
  sizeBytes: number;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileId: string;
  key: string;
}
