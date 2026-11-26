import { billingDb, type PayRow } from './db'
import { heeftAndereTerugbetaling } from './terugbetaling'
import { BENODIGDE_MAANDEN, telMaanden, type GratisPeriode } from './referralRegels'
import { wieIs } from './wie'
import { notifyTelegram } from '@/lib/cron-notify'

// Meldingen aan Arno voor wat bij een aangebrachte klant beloofd is maar nog niet automatisch gebeurt
// (docs/REFERRAL_CONTROLE_2026-11-26.md). Verdwijnt zodra het voordeel zelf is gebouwd.

/**
 * Waarom niet via Mollie: een terugbetaling van een hele maand telt als volledige terugbetaling en beëindigt het
 * abonnement, en ook een deel laat de betaling niet meer meetellen. Een bankoverschrijving ziet de app niet.
 */
export const VEILIG_TERUGSTORTEN = 'Stort per bankoverschrijving en maak een creditnota in Moneybird. NIET via een terugbetaling in Mollie: dan kan het abonnement stoppen.'

type Rij = PayRow & { cyclus?: string | null; periode_start?: string | null; periode_einde?: string | null }

/** Het voordeel van de nieuwe gebruiker is eenmalig. Automatisch vastgelegd is alleen de korting op een jaarbetaling. */
export function voordeelGebruikt(referral: { referred_discount?: number | string | null }): boolean {
  return Number(referral.referred_discount ?? 0) > 0
}

/**
 * Het aantal aaneengesloten betaalde maanden aan het eind van de rij, en of de benodigde reeks al eerder (vóór de
 * laatste maand) was gehaald. In dat laatste geval is het signaal al geweest.
 */
export function maandReeks(betalingen: Rij[], gratis: GratisPeriode[] = []): { reeks: number; eerderGehaald: boolean } {
  const maanden = betalingen
    .filter(b => b.status === 'paid' && b.cyclus === 'maandelijks' && !!b.periode_start && !!b.periode_einde
      && !b.terugbetaling_verwerkt_at && !(b.teruggeboekt_cent > 0) && !heeftAndereTerugbetaling(b, b.terugbetaald_cent ?? 0))
  const stand = telMaanden([
    ...maanden.map(m => ({ periodeStart: m.periode_start!, periodeEinde: m.periode_einde!, gratis: false })),
    ...gratis.map(g => ({ ...g, gratis: true })),
  ])
  const reeks = stand.at(-1)?.reeks ?? 0
  const eerderGehaald = stand.slice(0, -1).some(m => m.reeks >= BENODIGDE_MAANDEN)
  return { reeks, eerderGehaald }
}

/**
 * Na elke betaalde maand: is dit de derde van een aangebrachte klant, dan hoort de vierde gratis te zijn. Een fout hier
 * mag de betaalverwerking nooit tegenhouden.
 */
export async function meldGratisVierdeMaand(userId: string, vierdeIncassoRond: Date): Promise<void> {
  try {
    const { data: referral, error: refFout } = await billingDb.from('arnobot_referrals').select('id, referred_discount').eq('referred_user_id', userId)
      .maybeSingle<{ id: string; referred_discount: number | null }>()
    if (refFout) throw new Error(refFout.message)
    if (!referral || voordeelGebruikt(referral)) return
    const { data, error } = await billingDb.from('arnobot_payments').select('*').eq('user_id', userId).eq('status', 'paid').limit(1000).returns<Rij[]>()
    if (error) throw new Error(error.message)
    const { reeks, eerderGehaald } = maandReeks(data ?? [])
    if (reeks !== BENODIGDE_MAANDEN || eerderGehaald) return
    const datum = vierdeIncassoRond.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
    await notifyTelegram(`ACTIE: gratis vierde maand op arno.bot\n\nWie: ${await wieIs(userId)}\nDeze aangebrachte klant heeft ${BENODIGDE_MAANDEN} maanden betaald. De incasso rond ${datum} hoort gratis te zijn en dat gebeurt NIET automatisch. Controleer eerst of de eerste betaling op tijd was (eerste proef plus 15 dagen).\n${VEILIG_TERUGSTORTEN}`)
  } catch (e) {
    console.error('[billing] signaal gratis vierde maand mislukt', userId, e instanceof Error ? e.message : e)
    await notifyTelegram(`Controle op de gratis vierde maand mislukt op arno.bot\n\nUser: ${userId}\nKijk zelf of dit een aangebrachte klant is met drie betaalde maanden.`)
  }
}
