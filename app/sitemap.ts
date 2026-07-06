import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hulaan.ph'

// Public marketing/product routes only. Internal surfaces (/ops, /dev,
// /private, /app) are intentionally excluded and disallowed in robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1, changeFrequency: 'daily' },
    { path: '/worldcup', priority: 0.9, changeFrequency: 'daily' },
    { path: '/picks', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/hits', priority: 0.8, changeFrequency: 'weekly' },
  ]

  return routes.map((r) => ({
    url: `${SITE_URL}${r.path === '/' ? '' : r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
