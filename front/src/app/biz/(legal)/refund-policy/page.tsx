import type { Metadata } from 'next';
import { LegalPageBody } from '@/components/my/MyPages';

export const metadata: Metadata = {
  title: '환불 정책',
};

export default function Page() {
  return <LegalPageBody kind="refund-policy" />;
}
