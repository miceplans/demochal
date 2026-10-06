import type { BadgeTone } from '@/components/ui/Badge';

type BusinessVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface BizVerificationStatusPresentation {
  label: string;
  tone: BadgeTone;
}

export function presentBizVerificationStatus(
  status: BusinessVerificationStatus | string | undefined,
): BizVerificationStatusPresentation {
  switch (status) {
    case 'verified':
      return { label: '승인', tone: 'green' };
    case 'rejected':
      return { label: '반려', tone: 'red' };
    case 'pending':
    default:
      return { label: '미승인', tone: 'gray' };
  }
}
