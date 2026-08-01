import { MetadataRoute } from 'next'

// www, niet kaal: arno.bot zonder www stuurt altijd een 308-redirect naar www.arno.bot
// (bevestigd bij de Calendly-webhook-fix, zie CLAUDE.md), dus dit moet de canonieke vorm zijn.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://www.arno.bot',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: 'https://www.arno.bot/prijzen',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://www.arno.bot/command',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://www.arno.bot/privacy',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://www.arno.bot/voorwaarden',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
