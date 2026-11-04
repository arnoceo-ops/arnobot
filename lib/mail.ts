import { Resend, type CreateEmailOptions } from 'resend'
import * as Sentry from '@sentry/nextjs'
import { Redis } from '@upstash/redis'
import { notifyTelegram } from '@/lib/cron-notify'

// Eén plek voor alle mail via Resend. De Resend-bibliotheek GOOIT GEEN fout als een mail wordt
// geweigerd (daglimiet, maandlimiet, rate limit, ongeldig adres): hij geeft { data: null, error }
// terug. Wie alleen `await resend.emails.send(...)` doet merkt dus niets, en een cron die daarna
// "verzonden" in het logboek zet verliest de mail stil en probeert hem nooit opnieuw (gevonden
// 2026-11-04 in cron/trial-emails). Deze functie gooit wel, zodat de aanroeper kan kiezen: niet
// loggen en morgen opnieuw proberen, of de fout melden.

const LIMIET_CODES = new Set(['daily_quota_exceeded', 'monthly_quota_exceeded', 'rate_limit_exceeded'])

export class MailVerzendFout extends Error {
  readonly code: string
  /** Dag-, maand- of rate limit: tijdelijk, dezelfde mail kan later alsnog. */
  readonly limiet: boolean
  constructor(code: string, message: string) {
    super(`Resend ${code}: ${message}`)
    this.name = 'MailVerzendFout'
    this.code = code
    this.limiet = LIMIET_CODES.has(code)
  }
}

let client: Resend | null = null
const resend = () => (client ??= new Resend(process.env.RESEND_API_KEY))

/** Eén Telegram-melding per 6 uur, hoeveel mails er ook weigeren. */
async function meldLimiet(fout: MailVerzendFout): Promise<void> {
  Sentry.captureException(fout, { tags: { onderdeel: 'resend-limiet' }, level: 'warning' })
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (url && token) {
      const nieuw = await new Redis({ url, token }).set('arnobot:resend-limiet-gemeld', '1', { nx: true, ex: 6 * 3600 })
      if (!nieuw) return
    }
  } catch {
    // Zonder Redis liever een dubbele melding dan geen melding.
  }
  await notifyTelegram(
    `Resend weigert mails op arno.bot\n\nCode: ${fout.code}\nTrialmails worden de volgende dag opnieuw geprobeerd, andere mails kunnen verloren gaan. Controleer Resend, Settings, Usage, en upgrade naar Pro.`,
  )
}

/**
 * Verstuurt een mail via Resend en gooit een MailVerzendFout als Resend hem weigert.
 * Gebruik dit overal i.p.v. `resend.emails.send(...)` direct, behalve waar een mislukte mail
 * de flow niet mag breken: daar verstuurMailZacht.
 */
export async function verstuurMail(opties: CreateEmailOptions): Promise<{ id: string }> {
  const { data, error } = await resend().emails.send(opties)
  if (error || !data) {
    const fout = new MailVerzendFout(error?.name ?? 'onbekend', error?.message ?? 'geen antwoord van Resend')
    if (fout.limiet) await meldLimiet(fout)
    throw fout
  }
  return { id: data.id }
}

/**
 * Zelfde als verstuurMail, maar gooit nooit: voor mail die een flow niet mag breken (een
 * bevestiging na opzeggen, een melding aan de oprichter). Geeft false bij een weigering. De fout
 * gaat naar Sentry en een limiet komt als Telegram-melding, dus een mislukte mail blijft zichtbaar.
 */
export async function verstuurMailZacht(opties: CreateEmailOptions): Promise<boolean> {
  try {
    await verstuurMail(opties)
    return true
  } catch (e) {
    if (!(e instanceof MailVerzendFout)) Sentry.captureException(e, { tags: { onderdeel: 'mail' } })
    else if (!e.limiet) Sentry.captureException(e, { tags: { onderdeel: 'mail' }, level: 'warning' })
    console.error('[mail] versturen mislukt:', e instanceof Error ? e.message : e)
    return false
  }
}
