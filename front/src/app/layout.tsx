import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DEFAULT_SITE_ORIGIN, SITE_ORIGIN } from '@/lib/biz';
import { JsonLd } from '@/lib/JsonLd';
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE } from '@/lib/seo';
import { Providers } from './providers';
import '../styles/tokens.css';
import './globals.css';

const ORIGIN = SITE_ORIGIN || DEFAULT_SITE_ORIGIN;

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  // Search Console / 네이버 서치어드바이저 소유 확인 토큰(서버 전용 env, 없으면 생략).
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.NAVER_SITE_VERIFICATION
      ? { 'naver-site-verification': process.env.NAVER_SITE_VERIFICATION }
      : undefined,
  },
};

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${ORIGIN}/#website`,
      url: ORIGIN,
      name: SITE_NAME,
      alternateName: ['세모챌 공모전', '공모전 사이트 세모챌', 'semochall'],
      description: SITE_DESCRIPTION,
      inLanguage: 'ko-KR',
    },
    {
      '@type': 'Organization',
      '@id': `${ORIGIN}/#organization`,
      name: SITE_NAME,
      url: ORIGIN,
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <JsonLd data={siteJsonLd} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
