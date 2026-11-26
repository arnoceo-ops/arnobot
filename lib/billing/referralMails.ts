import { billingDb } from './db'
import { verstuurBillingMail } from './mails'
import { schakelaarAan } from './referralSchakelaars'
import { MEELOOP } from './referralStand'
import type { ActieRij } from './referralTerugstorten'
import type { GrootboekRegel } from './referralGrootboek'
import type { EmailType } from '@/lib/email-templates'
import { isInternalTestUser } from '@/lib/internalTestAccounts'

// De klantmails van de referralautomatisering, vanuit de dagelijkse uitvoerronde. Achter REFERRAL_MAILS.
// Hooguit een keer: eerst mail_at claimen, dan versturen; lukt versturen niet, dan de claim terug.
// Alleen over wat de laatste dagen gebeurde: bij het aanzetten krijgt niemand een stapel oude berichten.

export const MAIL_VENSTER_DAGEN = 14

const REDEN: Record<string, string> = { voordeel_maand: 'je gratis vierde maand', voordeel_jaar: 'de korting op je jaarabonnement' }
const REGEL_MAIL: Partial<Record<GrootboekRegel['soort'], EmailType>> = {
  toekenning: 'referral_tegoed_toegekend', verval: 'referral_tegoed_vervallen', terugdraaiing: 'referral_tegoed_teruggedraaid',
}

type MetMail<T> = T & { id: string; mail_at?: string | null }

export async function verstuurReferralMails(nu: Date): Promise<{ verstuurd: number; mislukt: number }> {
  const uit = { verstuurd: 0, mislukt: 0 }
  if (!schakelaarAan('REFERRAL_MAILS')) return uit
  const recent = (iso?: string) => !!iso && nu.getTime() - Date.parse(iso) <= MAIL_VENSTER_DAGEN * 24 * 60 * 60 * 1000

  async function eenKeer(tabel: string, id: string, userId: string, type: EmailType, billing: Parameters<typeof verstuurBillingMail>[2]) {
    const { data, error } = await billingDb.from(tabel).update({ mail_at: nu.toISOString() }).eq('id', id).is('mail_at', null).select('id')
    if (error) throw new Error(`mail claimen mislukt: ${error.message}`)
    if (data?.length !== 1) return
    if (await verstuurBillingMail(userId, type, billing)) { uit.verstuurd++; return }
    uit.mislukt++
    await billingDb.from(tabel).update({ mail_at: null }).eq('id', id)
  }

  const { data: acties, error: actieFout } = await billingDb.from('arnobot_referral_acties').select('*').eq('status', 'bevestigd')
    .is('mail_at', null).order('created_at', { ascending: false }).limit(200)
  if (actieFout) throw new Error(`referralacties ophalen mislukt: ${actieFout.message}`)
  for (const a of (acties ?? []) as MetMail<ActieRij>[]) {
    // Met de hand ingeboekt is geen terugstorting van ons: daar hoort geen mail bij.
    if (!recent(a.created_at) || isInternalTestUser(a.user_id) || a.doel_id.startsWith('handmatig:')) continue
    await eenKeer('arnobot_referral_acties', a.id, a.user_id, a.soort.startsWith('voordeel') ? 'referral_voordeel' : 'referral_tegoed_verrekend',
      { bedragCent: a.bruto_cent, reden: REDEN[a.soort] })
  }

  // Over meeloopregels gaat nooit een mail uit.
  if (MEELOOP) return uit
  const { data: regels, error: regelFout } = await billingDb.from('arnobot_referral_grootboek').select('*').eq('meeloop', false)
    .is('mail_at', null).in('soort', Object.keys(REGEL_MAIL)).order('created_at', { ascending: false }).limit(200)
  if (regelFout) throw new Error(`grootboek ophalen mislukt: ${regelFout.message}`)
  for (const r of (regels ?? []) as MetMail<GrootboekRegel>[]) {
    const type = REGEL_MAIL[r.soort]
    // Een verval of terugdraaiing van niets is geen bericht waard; de correcties bij een bevestiging met de hand ook niet.
    if (!type || !recent(r.created_at) || isInternalTestUser(r.aanbrenger_user_id)) continue
    if (r.soort !== 'toekenning' && (!r.netto_cent || r.netto_cent > 0 || r.event_key.includes(':correctie:'))) continue
    await eenKeer('arnobot_referral_grootboek', r.id, r.aanbrenger_user_id, type,
      r.netto_cent === null ? {} : { bedragCent: Math.abs(r.netto_cent) })
  }
  return uit
}
