import type { Metadata } from 'next';
import { LoginPage as UserLoginPage } from '@/components/auth/AuthPages';

export const metadata: Metadata = {
  title: '로그인',
};

export default function LoginPage() {
  return <UserLoginPage />;
}
