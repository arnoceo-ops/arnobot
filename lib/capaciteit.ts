import { Redis } from '@upstash/redis'

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

/** Telt een Anthropic-limietfout (HTTP 429). Andere fouten (overbelasting, 5xx) tellen niet: dat is Anthropic zelf, geen tier-probleem. */
export async function telAnthropicLimiet(err: unknown): Promise<void> {
  try {
    if ((err as { status?: number } | null)?.status !== 429) return
    const r = redis()
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
