import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/$', '/prijzen', '/gesprek/'],
        disallow: '/',
      },
    ],
    sitemap: 'https://arno.bot/sitemap.xml',
  }
}
