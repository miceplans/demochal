import type { Metadata } from 'next';
import { BizLanding } from '@/components/biz/BizLanding';

export const metadata: Metadata = {
  title: 'SEMO.BIZ: 쉬운 행사 관리',
};

export default function BizPage() {
  return <BizLanding />;
}
