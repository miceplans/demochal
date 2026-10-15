import { SetMetadata } from '@nestjs/common';

export const MFA_FLOW_KEY = 'mfaFlow';

/**
 * MFA 엔드포인트별 인증 흐름.
 * - manage: 관리·삭제 — 유효한 admin/business 세션 쿠키 필수
 * - enroll: 수단 등록 — 쿠키(admin/business) 또는 body의 mfa-enroll 토큰
 * - pending: 로그인 검증 — body의 mfa-pending 토큰(대상 계정의 역할·수단을 재확인)
 */
export type MfaFlowKind = 'manage' | 'enroll' | 'pending';

export const MfaFlow = (flow: MfaFlowKind) => SetMetadata(MFA_FLOW_KEY, flow);
