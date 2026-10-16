import type { Metadata } from 'next';
import { LegalPageBody } from '@/components/my/MyPages';

export const metadata: Metadata = {
  title: '광고 운영정책',
};

export default function Page() {
  return <LegalPageBody kind="advertising-policy" />;
}
