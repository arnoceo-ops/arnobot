import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/$', '/blog', '/blog/', '/gesprek/'],
        disallow: '/',
      },
    ],
    sitemap: 'https://arno.bot/sitemap.xml',
  }
}
