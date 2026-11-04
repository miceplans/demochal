import { isSafeLinkUrl } from '@/components/profile/link-model';

export const PROFILE_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PROFILE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const certificateBadges = ['자격증', '수료증', '어학성적', '수상경력'];
export const CERTIFICATE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
export const CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;
export const CERTIFICATE_MAX_FILES = 5;

export const formatParticipatingDay = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '';

export type ParticipatingItem = {
  key: string;
  href: string;
  title: string;
  sub?: string;
  role?: string;
  meta: string;
};

export function challengeResultTag(status?: string): {
  label: string;
  tone: 'green' | 'blue' | 'red';
} {
  if (status === 'accepted') return { label: '예선 통과', tone: 'green' };
  if (status === 'rejected') return { label: '불합격', tone: 'red' };
  return { label: '심사중', tone: 'blue' };
}

export function teamResultTag(status?: string): { label: string; tone: 'green' | 'blue' | 'red' } {
  if (status === 'accepted') return { label: '합격', tone: 'blue' };
  if (status === 'rejected') return { label: '불합격', tone: 'red' };
  return { label: '검토중', tone: 'green' };
}

export function acceptedChatLink(status: string | undefined, raw: unknown): string | undefined {
  if (status !== 'accepted' || typeof raw !== 'string') return undefined;
  const value = raw.trim();
  return isSafeLinkUrl(value) ? value : undefined;
}

export const applicantResultOptions = ['미정', '합격', '불합격'].map((x) => ({
  value: x,
  label: x,
}));
export type ApplicantResult = '미정' | '합격' | '불합격';

export const resultFromStatus = (status?: string): ApplicantResult =>
  status === 'accepted' ? '합격' : status === 'rejected' ? '불합격' : '미정';

// 서버는 team_matching, team.created, team.application.submitted, application.submitted(챌린지 신청 접수), verification.result, deadline(북마크 마감), posting(북마크 접수 시작·관심분야 새 챌린지), content.rejected(관리자 반려), refund.result(환불 승인·반려) 알림을 생성한다.
// 매핑되지 않은 유형은 '전체'에서만 보인다.
export const notificationTabs = ['전체', '팀매칭', '공고'] as const;
export type NotificationTab = (typeof notificationTabs)[number];
export type NotificationCategory = NotificationTab | '인증·결과' | '마감';
export const notificationCategory: Record<string, NotificationCategory> = {
  team_matching: '팀매칭',
  'verification.result': '인증·결과',
  'content.rejected': '인증·결과',
  'refund.result': '인증·결과',
  deadline: '마감',
  posting: '공고',
};

export function describeNotification(type: string, payload: Record<string, unknown>) {
  if (type === 'team_matching') {
    if (typeof payload.invitedUserId === 'string') return '팀에 초대가 왔어요';
    if (typeof payload.applicantUserId === 'string') {
      if (payload.inviteAccepted === true) return '초대가 수락했어요';
      return '새 지원자가 팀에 지원했어요';
    }
    if (payload.status === 'accepted') return '지원이 수락됐어요';
    if (payload.status === 'rejected') return '지원이 거절됐어요';
    return '팀 매칭 알림이 있어요';
  }
  if (type === 'verification.result') {
    if (payload.status === 'approved' || payload.status === 'verified')
      return '사업자 인증이 승인됐어요';
    if (payload.status === 'rejected') return '사업자 인증이 반려됐어요';
    return '사업자 인증 결과가 도착했어요';
  }
  if (type === 'content.rejected') {
    return payload.targetType === 'team' ? '팀 모집글이 반려됐어요' : '챌린지 공고가 반려됐어요';
  }
  if (type === 'refund.result') {
    return payload.status === 'approved'
      ? '환불이 승인되어 결제가 취소됐어요'
      : '환불 요청이 반려됐어요';
  }
  if (type === 'application.submitted') {
    const title = typeof payload.challengeTitle === 'string' ? payload.challengeTitle : '';
    return title ? `'${title}' 참가 신청이 접수됐어요` : '챌린지 참가 신청이 접수됐어요';
  }
  if (type === 'team.created') {
    const title = typeof payload.title === 'string' ? payload.title : '';
    return title ? `'${title}' 팀을 만들었어요` : '팀을 만들었어요';
  }
  if (type === 'team.application.submitted') return '팀 참가 신청이 접수됐어요';
  if (type === 'deadline') {
    const daysLeft = typeof payload.daysLeft === 'number' ? payload.daysLeft : undefined;
    const dday = daysLeft === undefined ? '' : daysLeft === 0 ? ' D-Day' : ` D-${daysLeft}`;
    return `북마크한 챌린지 마감${dday}`;
  }
  if (type === 'posting') {
    if (payload.kind === 'bookmark_open') return '북마크한 챌린지 참가접수가 시작되었어요';
    if (payload.kind === 'interest_new') return '관심분야 새 챌린지가 등록되었어요';
    return '새 공고가 등록됐어요';
  }
  return '새 알림이 있어요';
}

export function timeAgo(iso: string | undefined, now: number) {
  if (!iso) return '';
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / (60 * 24))}일 전`;
}

export type LegalSection = { heading: string; body: string; isChapter: boolean };
const isLegalHeading = (value: string) => /^제\s*\d+\s*(장|조)/.test(value);
const isLegalChapter = (value: string) => /^제\s*\d+\s*장/.test(value);
export function buildLegalSections(articles: string[]): LegalSection[] {
  const sections: LegalSection[] = [];
  for (let i = 0; i < articles.length;) {
    const next = articles[i + 1];
    const hasBody = next !== undefined && !isLegalHeading(next);
    sections.push({
      heading: articles[i],
      body: hasBody ? next : '',
      isChapter: isLegalChapter(articles[i]),
    });
    i += hasBody ? 2 : 1;
  }
  return sections;
}
