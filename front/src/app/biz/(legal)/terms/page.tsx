import type { Metadata } from 'next';
import { LegalPageBody } from '@/apps/user/components/my/MyPages';

export const metadata: Metadata = {
  title: '이용약관',
};

export default function Page() {
  return <LegalPageBody kind="terms" />;
}
