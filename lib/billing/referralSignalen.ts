import { billingDb, type PayRow } from './db'
import { heeftAndereTerugbetaling } from './terugbetaling'
import { BENODIGDE_MAANDEN, MAX_ONDERBREKING_DAGEN } from './referralRegels'
import { wieIs } from './wie'
import { notifyTelegram } from '@/lib/cron-notify'

// Meldingen aan Arno voor wat bij een aangebrachte klant beloofd is maar nog niet automatisch gebeurt
// (docs/REFERRAL_CONTROLE_2026-11-26.md). Verdwijnt zodra het voordeel zelf is gebouwd.

/**
 * Waarom niet via Mollie: een terugbetaling van een hele maand telt als volledige terugbetaling en beëindigt het
 * abonnement, en ook een deel laat de betaling niet meer meetellen. Een bankoverschrijving ziet de app niet.
 */
export const VEILIG_TERUGSTORTEN = 'Stort per bankoverschrijving en maak een creditnota in Moneybird. NIET via een terugbetaling in Mollie: dan kan het abonnement stoppen.'

const DAG_MS = 24 * 60 * 60 * 1000

type Rij = PayRow & { cyclus?: string | null; periode_start?: string | null; periode_einde?: string | null }

/** Het aantal aaneengesloten betaalde maanden aan het eind van de rij. */
export function aaneengeslotenMaanden(betalingen: Rij[]): number {
  const maanden = betalingen
    .filter(b => b.status === 'paid' && b.cyclus === 'maandelijks' && !!b.periode_start && !!b.periode_einde
      && !b.terugbetaling_verwerkt_at && !(b.teruggeboekt_cent > 0) && !heeftAndereTerugbetaling(b, b.terugbetaald_cent ?? 0))
    .sort((a, b) => Date.parse(a.periode_start!) - Date.parse(b.periode_start!))
  let reeks = 0
  let vorigeEinde: number | null = null
  for (const m of maanden) {
    const aansluitend = vorigeEinde !== null && Date.parse(m.periode_start!) - vorigeEinde <= MAX_ONDERBREKING_DAGEN * DAG_MS
    reeks = aansluitend ? reeks + 1 : 1
    vorigeEinde = Date.parse(m.periode_einde!)
  }
  return reeks
}

/**
 * Na elke betaalde maand: is dit de derde van een aangebrachte klant, dan hoort de vierde gratis te zijn. Een fout hier
 * mag de betaalverwerking nooit tegenhouden.
 */
export async function meldGratisVierdeMaand(userId: string, vierdeIncassoRond: Date): Promise<void> {
  try {
    const { data: referral, error: refFout } = await billingDb.from('arnobot_referrals').select('id').eq('referred_user_id', userId).maybeSingle<{ id: string }>()
    if (refFout) throw new Error(refFout.message)
    if (!referral) return
    const { data, error } = await billingDb.from('arnobot_payments').select('*').eq('user_id', userId).eq('status', 'paid').limit(1000).returns<Rij[]>()
    if (error) throw new Error(error.message)
    if (aaneengeslotenMaanden(data ?? []) !== BENODIGDE_MAANDEN) return
    const datum = vierdeIncassoRond.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
    await notifyTelegram(`ACTIE: gratis vierde maand op arno.bot\n\nWie: ${await wieIs(userId)}\nDeze aangebrachte klant heeft ${BENODIGDE_MAANDEN} maanden betaald. De incasso rond ${datum} hoort gratis te zijn en dat gebeurt NIET automatisch. Controleer eerst of de eerste betaling op tijd was (proef plus 15 dagen).\n${VEILIG_TERUGSTORTEN}`)
  } catch (e) {
    console.error('[billing] signaal gratis vierde maand mislukt', userId, e instanceof Error ? e.message : e)
    await notifyTelegram(`Controle op de gratis vierde maand mislukt op arno.bot\n\nUser: ${userId}\nKijk zelf of dit een aangebrachte klant is met drie betaalde maanden.`)
  }
}
