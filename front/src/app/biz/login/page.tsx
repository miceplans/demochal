import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo';
import { BizLoginPage as BizLoginScreen } from '@/features/biz/components/BizLoginPage';

export const metadata: Metadata = {
  title: '기업 로그인',
  ...noIndexMetadata,
};

export default function BizLoginPage() {
  return <BizLoginScreen />;
}
