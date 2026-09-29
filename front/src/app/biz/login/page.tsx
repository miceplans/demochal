import type { Metadata } from 'next';
import { BizLoginPage as BizLoginScreen } from '@/features/biz/components/BizLoginPage';

export const metadata: Metadata = {
  title: '기업 로그인',
};

export default function BizLoginPage() {
  return <BizLoginScreen />;
}
