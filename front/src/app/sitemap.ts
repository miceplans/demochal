import type { MetadataRoute } from 'next';

import { DEFAULT_SITE_ORIGIN, SITE_ORIGIN } from '@/lib/biz';

const ORIGIN = SITE_ORIGIN || DEFAULT_SITE_ORIGIN;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${ORIGIN}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${ORIGIN}/explore`, changeFrequency: 'daily', priority: 0.9 },
    {
      url: `${ORIGIN}/contests/public-data`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${ORIGIN}/contests/public-data/teams`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    { url: `${ORIGIN}/teams`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${ORIGIN}/youth`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${ORIGIN}/advertising`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${ORIGIN}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${ORIGIN}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
