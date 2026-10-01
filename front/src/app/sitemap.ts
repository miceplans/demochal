import type { MetadataRoute } from 'next';

import { SITE_ORIGIN } from '@/lib/biz';

const PRODUCTION_ORIGIN = 'https://www.semochall.com';

const ORIGIN = SITE_ORIGIN || PRODUCTION_ORIGIN;

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
