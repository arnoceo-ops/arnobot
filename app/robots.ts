import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/$', '/gesprek/'],
        disallow: '/',
      },
    ],
    sitemap: 'https://arno.bot/sitemap.xml',
  }
}
