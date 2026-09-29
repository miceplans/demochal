import type { Metadata } from 'next';
import { LoginPage as UserLoginPage } from '@/components/auth/AuthPages';
import { sanitizeNextPath } from '@/lib/next-path';

export const metadata: Metadata = {
  title: '로그인',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <UserLoginPage next={sanitizeNextPath(Array.isArray(next) ? next[0] : next)} />;
}
