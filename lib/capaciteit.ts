import { Redis } from '@upstash/redis'
import { notifyTelegram } from '@/lib/cron-notify'

// Eigen tellers voor de capaciteitswacht (cron/capaciteitswacht), in Redis. Bewust zelf geteld:
// Resend heeft geen gebruiksendpoint dat we kunnen bevragen, en Anthropic geeft alleen een
// momentopname van de limiet. Alles faalt stil: een teller mag nooit een mail of chat breken.

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? new Redis({ url, token }) : null
}

export const dagSleutel = (d: Date = new Date()) => d.toISOString().slice(0, 10)
export const maandSleutel = (d: Date = new Date()) => d.toISOString().slice(0, 7)

const MAIL_DAG = (dag: string) => `arnobot:capaciteit:mail:dag:${dag}`
const MAIL_MAAND = (maand: string) => `arnobot:capaciteit:mail:maand:${maand}`
const ANTHROPIC_429 = (dag: string) => `arnobot:capaciteit:anthropic429:dag:${dag}`

/** Telt één door Resend geaccepteerde mail (per dag en per maand, UTC). */
export async function telMail(): Promise<void> {
  try {
    const r = redis()
    if (!r) return
    const nu = new Date()
    const p = r.pipeline()
    p.incr(MAIL_DAG(dagSleutel(nu)))
    p.expire(MAIL_DAG(dagSleutel(nu)), 3 * 86400)
    p.incr(MAIL_MAAND(maandSleutel(nu)))
    p.expire(MAIL_MAAND(maandSleutel(nu)), 40 * 86400)
    await p.exec()
  } catch {
    // Teller stuk: de mail zelf is al verstuurd.
  }
}

/** Herkent de Anthropic-fout bij een leeg tegoed (HTTP 400, "credit balance is too low"). */
export function isSaldoOp(err: unknown): boolean {
  const e = err as { status?: number; message?: string } | null
  return e?.status === 400 && /credit balance/i.test(e?.message ?? '')
}

/**
 * Telt een Anthropic-limietfout (HTTP 429) voor het dagrapport. Andere fouten (overbelasting, 5xx)
 * tellen niet: dat is Anthropic zelf, geen tier-probleem. Een leeg tegoed (400) is wel urgent en
 * wacht niet op de dagelijkse cron: dat geeft meteen een Telegram-melding, hooguit één per uur.
 */
export async function telAnthropicLimiet(err: unknown): Promise<void> {
  try {
    const r = redis()
    if (isSaldoOp(err)) {
      const nieuw = r ? await r.set('arnobot:capaciteit:saldo-op-gemeld', '1', { nx: true, ex: 3600 }) : 'OK'
      if (nieuw) {
        await notifyTelegram(
          'ArnoBot capaciteit: ACTIE NODIG\n\nHet Anthropic-tegoed is op, de chat geeft gebruikers nu geen antwoord. Open console.anthropic.com, Billing, en controleer of de automatische bijvulling is mislukt (kaart geweigerd?). Koop direct credits.',
        )
      }
      return
    }
    if ((err as { status?: number } | null)?.status !== 429) return
    if (!r) return
    const sleutel = ANTHROPIC_429(dagSleutel())
    await r.incr(sleutel)
    await r.expire(sleutel, 3 * 86400)
  } catch {
    // zie telMail
  }
}

export type Tellers = { mailDag: number; mailMaand: number; anthropic429Dag: number }

export async function leesTellers(): Promise<Tellers> {
  const r = redis()
  if (!r) return { mailDag: 0, mailMaand: 0, anthropic429Dag: 0 }
  const nu = new Date()
  const [mailDag, mailMaand, a429] = await Promise.all([
    r.get<number>(MAIL_DAG(dagSleutel(nu))),
    r.get<number>(MAIL_MAAND(maandSleutel(nu))),
    r.get<number>(ANTHROPIC_429(dagSleutel(nu))),
  ])
  return { mailDag: Number(mailDag ?? 0), mailMaand: Number(mailMaand ?? 0), anthropic429Dag: Number(a429 ?? 0) }
}
