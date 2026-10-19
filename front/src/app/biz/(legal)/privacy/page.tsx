import type { Metadata } from 'next';
import { LegalPageBody } from '@/components/my/MyPages';

export const metadata: Metadata = {
  title: '개인정보처리방침',
};

export default function Page() {
  return <LegalPageBody kind="privacy" />;
}
