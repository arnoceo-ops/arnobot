import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/$', '/blog', '/blog/'],
        disallow: '/',
      },
    ],
    sitemap: 'https://arno.bot/sitemap.xml',
  }
}
