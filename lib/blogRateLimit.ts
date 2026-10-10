import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { NextRequest } from 'next/server'

// Ratelimits voor de publieke blog-endpoints (aanmelden, bevestigen, afmelden, voorkeuren).
// Aanmelden is het kwetsbaarste: zonder limiet kan het formulier misbruikt worden om een
// willekeurig adres met bevestigingsmails te bestoken of om de lijst vol te pompen.

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const subscribeIpLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'arnobot:blog-subscribe-ip',
})

// Per adres, los van het IP: een aanvaller met veel IP's kan één slachtoffer anders alsnog
// overspoelen met bevestigingsmails.
export const subscribeEmailLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 d'),
  prefix: 'arnobot:blog-subscribe-email',
})

export const tokenIpLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'arnobot:blog-token-ip',
})

// Eén-klik-afmelden komt van de mailserver van de ontvanger (Gmail, Outlook), dus veel afmeldingen
// kunnen van hetzelfde IP komen. Ruimer dan de andere token-endpoints.
export const unsubscribeIpLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, '1 m'),
  prefix: 'arnobot:blog-unsubscribe-ip',
})

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
