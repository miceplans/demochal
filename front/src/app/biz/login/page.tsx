import type { Metadata } from 'next';
import { BizLoginFlow } from '@/features/biz/components/BizLoginFlow';

export const metadata: Metadata = {
  title: '기업용 회원가입',
};

export default function BizLoginPage() {
  return <BizLoginFlow />;
}
