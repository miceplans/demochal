import type { Metadata } from 'next';
import { LegalPageBody } from '@/components/my/MyPages';

export const metadata: Metadata = {
  title: '이용약관',
};

export default function Page() {
  return <LegalPageBody kind="terms" />;
}
