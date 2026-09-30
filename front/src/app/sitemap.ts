import type { MetadataRoute } from 'next';

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://www.semochall.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${SITE_ORIGIN}/`, lastModified, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_ORIGIN}/explore`, lastModified, changeFrequency: 'daily', priority: 0.9 },
    {
      url: `${SITE_ORIGIN}/contests/public-data`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_ORIGIN}/contests/public-data/teams`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    { url: `${SITE_ORIGIN}/teams`, lastModified, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_ORIGIN}/youth`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_ORIGIN}/advertising`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_ORIGIN}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_ORIGIN}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
