import type { BadgeTone } from '@/apps/user/components/ui/Badge';

// 서버 displayStatus는 verified→'승인', rejected→'반려'를 내린다(server business-status.ts).
// 그 외 값(레거시 가승인 등)이 날아와도 뱃지가 깨지지 않도록 amber으로 폰백한다.
const verificationTone = (displayStatus?: string): BadgeTone =>
  displayStatus === '승인' ? 'green' : displayStatus === '반려' ? 'red' : 'amber';

interface IntroBlock {
  type?: string;
  content?: Record<string, unknown>;
}

const PAGE_SIZE = 8;

export type { IntroBlock };
export { PAGE_SIZE, verificationTone };
