import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo';
import { BizSignupFlow } from '@/features/biz/components/BizLoginFlow';

export const metadata: Metadata = {
  title: '기업용 회원가입',
  ...noIndexMetadata,
};

export default function BizSignupPage() {
  return <BizSignupFlow />;
}
