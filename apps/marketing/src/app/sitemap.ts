import type { MetadataRoute } from 'next';

const BASE = 'https://myriderguy.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/about', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/for-riders', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/for-businesses', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/careers', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/contact', priority: 0.6, changeFrequency: 'yearly' as const },
    { path: '/rider-stories', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/cookies', priority: 0.3, changeFrequency: 'yearly' as const },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path}`,
    lastModified: new Date('2026-04-10'),
    changeFrequency,
    priority,
  }));
}
