import type { MetadataRoute } from 'next';

import { DEFAULT_SITE_ORIGIN, SITE_ORIGIN } from '@/lib/biz';

const ORIGIN = SITE_ORIGIN || DEFAULT_SITE_ORIGIN;

export default function robots(): MetadataRoute.Robots {
  return {
    // 비공개 영역은 색인을 막는다. /biz 아래에는 공개 페이지(랜딩/로그인/약관)가 있어
    // 비공개 콘솔 경로만 Disallow한다.
    // https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/auth',
        '/my',
        '/admin',
        '/onboarding',
        '/payments',
        '/biz/ads',
        '/biz/applications',
        '/biz/billing',
        '/biz/dashboard',
        '/biz/operations',
        '/biz/postings',
        '/biz/profile',
        '/biz/reports',
      ],
    },
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}
