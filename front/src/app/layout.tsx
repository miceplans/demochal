import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DEFAULT_SITE_ORIGIN, SITE_ORIGIN } from '@/lib/biz';
import { Providers } from './providers';
import '../styles/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN || DEFAULT_SITE_ORIGIN),
  title: {
    default: '세모챌',
    template: '%s | 세모챌',
  },
  description: '세모챌에서 세상의 모든 챌린지를 만나보세요!',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
