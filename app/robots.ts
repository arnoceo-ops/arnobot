import { MetadataRoute } from 'next'

const PUBLIC_PATHS = ['/$', '/prijzen', '/team', '/privacy', '/voorwaarden', '/gesprek/']

// Bekende AI-crawlers expliciet dezelfde toegang geven als gewone zoekmachines, i.p.v.
// impliciet op de '*'-regel leunen: zichtbaar bedoeld beleid, en toekomstbestendig als
// een van deze bots ooit een ander default-gedrag krijgt dan reguliere crawlers.
const AI_USER_AGENTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended',
  'CCBot',
]

// Crawlers die alleen het voorbeeld (titel, tekst, afbeelding) ophalen als iemand een link deelt in
// LinkedIn, WhatsApp, Slack enzovoort. Zij mogen /blog lezen, ook nu de blog voor zoekmachines nog
// niet is opengezet: zonder dit toont LinkedIn "Cannot display preview" bij het delen van een artikel.
// Google en andere zoekmachines staan hier bewust niet bij, die volgen de algemene regel hierboven.
const SHARE_USER_AGENTS = [
  'LinkedInBot', 'facebookexternalhit', 'Facebot', 'Twitterbot',
  'Slackbot', 'Slackbot-LinkExpanding', 'WhatsApp', 'TelegramBot', 'Discordbot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: SHARE_USER_AGENTS,
        allow: [...PUBLIC_PATHS, '/blog'],
        disallow: '/',
      },
      {
        userAgent: '*',
        allow: PUBLIC_PATHS,
        disallow: '/',
      },
      {
        userAgent: AI_USER_AGENTS,
        allow: PUBLIC_PATHS,
        disallow: '/',
      },
    ],
    // www, niet kaal: arno.bot zonder www stuurt altijd een 308-redirect naar www.arno.bot
    // (bevestigd bij de Calendly-webhook-fix, zie CLAUDE.md), dus dit moet de canonieke vorm zijn.
    sitemap: 'https://www.arno.bot/sitemap.xml',
  }
}
