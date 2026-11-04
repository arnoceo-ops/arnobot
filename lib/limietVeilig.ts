import * as Sentry from '@sentry/nextjs'
import type { Ratelimit } from '@upstash/ratelimit'

// Een rate limit mag de dienst niet stilleggen als de limiter zelf stuk is. @upstash/ratelimit
// laat een verzoek door bij een time-out (standaard 5 seconden), maar GOOIT een fout bij een
// echte Upstash-storing of -weigering: zonder deze wrapper gaf dat een 500 voor iedereen. Een
// echte overschrijding blijft gewoon { success: false }.
//
// Fail-open is hier bewust: bij een storing is het gebruikersverlies groter dan het misbruikrisico,
// en Vercel Firewall en de dagelijkse limiet per gebruiker (Supabase) blijven als vangnet.

let laatsteMelding = 0

export async function limietVeilig(limiter: Ratelimit, identifier: string): Promise<{ success: boolean }> {
  try {
    const { success } = await limiter.limit(identifier)
    return { success }
  } catch (e) {
    // Hooguit één Sentry-melding per minuut, anders vult een storing de quota.
    if (Date.now() - laatsteMelding > 60_000) {
      laatsteMelding = Date.now()
      Sentry.captureException(e, { tags: { onderdeel: 'ratelimit-upstash' }, level: 'warning' })
    }
    return { success: true }
  }
}
