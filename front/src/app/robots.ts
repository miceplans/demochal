import type { MetadataRoute } from 'next';

import { DEFAULT_SITE_ORIGIN, SITE_ORIGIN } from '@/lib/biz';

const ORIGIN = SITE_ORIGIN || DEFAULT_SITE_ORIGIN;

export default function robots(): MetadataRoute.Robots {
  return {
    // TODO: 비공개 경로(/auth, /my, /admin, /biz, /onboarding, /payments, /notifications)
    // Disallow 정책은 human 결정 후 반영 (잘못된 Disallow는 색인 차단 위험).
    // https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}
