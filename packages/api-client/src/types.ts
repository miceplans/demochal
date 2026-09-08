// Shared domain types between front/ and server/.
// TODO: replace with OpenAPI-generated types once server exposes /openapi.json
// (see packages/api-client/README.md for the planned codegen step).

export type Role = 'user' | 'business' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Business {
  id: string;
  ownerUserId: string;
  name: string;
  registrationNumber: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: string;
}

export interface Verification {
  id: string;
  businessId: string;
  documentFileId: string;
  status: 'pending' | 'processing' | 'verified' | 'rejected';
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
}

export interface Application {
  id: string;
  challengeId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
}

export interface Order {
  id: string;
  applicationId: string;
  userId: string;
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  createdAt: string;
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
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileId: string;
  key: string;
}
