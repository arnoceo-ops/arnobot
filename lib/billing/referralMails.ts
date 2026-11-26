import { billingDb } from './db'
import { verstuurBillingMail } from './mails'
import { schakelaarAan } from './referralSchakelaars'
import { MEELOOP } from './referralStand'
import type { ActieRij } from './referralTerugstorten'
import type { GrootboekRegel } from './referralGrootboek'
import { isTeruggedraaid } from './referralSaldo'
import type { EmailType } from '@/lib/email-templates'
import { isInternalTestUser } from '@/lib/internalTestAccounts'

// De klantmails van de referralautomatisering, vanuit de dagelijkse uitvoerronde. Achter REFERRAL_MAILS.
// Hooguit een keer: eerst mail_at claimen, dan versturen; lukt versturen niet, dan de claim terug.
// Alleen over wat na REFERRAL_MAILS_VANAF gebeurde (zonder die datum gaat er niets uit) en de laatste dagen: bij het
// aanzetten of bij de livegang van het grootboek (dan worden regels opnieuw aangemaakt) krijgt niemand een oude stapel.

export const MAIL_VENSTER_DAGEN = 14

const REDEN: Record<string, string> = { voordeel_maand: 'je gratis vierde maand', voordeel_jaar: 'de korting op je jaarabonnement' }
const REGEL_MAIL: Partial<Record<GrootboekRegel['soort'], EmailType>> = {
  toekenning: 'referral_tegoed_toegekend', verval: 'referral_tegoed_vervallen', terugdraaiing: 'referral_tegoed_teruggedraaid',
}

type MetMail<T> = T & { id: string; mail_at?: string | null }

export async function verstuurReferralMails(nu: Date): Promise<{ verstuurd: number; mislukt: number }> {
  const uit = { verstuurd: 0, mislukt: 0 }
  if (!schakelaarAan('REFERRAL_MAILS')) return uit
  const vanaf = Date.parse(process.env.REFERRAL_MAILS_VANAF ?? '')
  if (!Number.isFinite(vanaf)) return uit
  const recent = (iso?: string) => !!iso && Date.parse(iso) >= vanaf && nu.getTime() - Date.parse(iso) <= MAIL_VENSTER_DAGEN * 24 * 60 * 60 * 1000

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
    // Het venster telt vanaf de bevestiging: na lang wachten bij Mollie hoort de mail er alsnog bij.
    if (!recent(a.updated_at ?? a.created_at) || isInternalTestUser(a.user_id) || a.doel_id.startsWith('handmatig:')) continue
    await eenKeer('arnobot_referral_acties', a.id, a.user_id, a.soort.startsWith('voordeel') ? 'referral_voordeel' : 'referral_tegoed_verrekend',
      { bedragCent: a.bruto_cent, reden: REDEN[a.soort] })
  }

  // Over meeloopregels gaat nooit een mail uit.
  if (MEELOOP) return uit
  const { data: regels, error: regelFout } = await billingDb.from('arnobot_referral_grootboek').select('*').eq('meeloop', false)
    .is('mail_at', null).in('soort', Object.keys(REGEL_MAIL)).order('created_at', { ascending: true }).limit(200)
  if (regelFout) throw new Error(`grootboek ophalen mislukt: ${regelFout.message}`)
  /** Is dit bericht al achterhaald door een latere regel? Dan niet versturen. */
  const achterhaald = async (r: GrootboekRegel): Promise<boolean> => {
    if (r.soort === 'verval') return false
    const { data, error } = await billingDb.from('arnobot_referral_grootboek').select('*').eq('meeloop', false).eq('referral_id', r.referral_id)
    if (error) throw new Error(`grootboek ophalen mislukt: ${error.message}`)
    const alle = (data ?? []) as GrootboekRegel[]
    const teruggedraaid = isTeruggedraaid(alle, r.referral_id)
    // Een toekenning die al teruggedraaid of vervallen is, en een terugdraaiing die al hersteld is.
    return r.soort === 'toekenning' ? teruggedraaid || alle.some(x => x.soort === 'verval' && !!x.netto_cent && x.netto_cent < 0) : !teruggedraaid
  }
  for (const r of (regels ?? []) as MetMail<GrootboekRegel>[]) {
    const type = REGEL_MAIL[r.soort]
    // Een verval of terugdraaiing van niets is geen bericht waard; de correcties bij een bevestiging met de hand ook niet.
    if (!type || !recent(r.created_at) || isInternalTestUser(r.aanbrenger_user_id)) continue
    if (r.soort !== 'toekenning' && (!r.netto_cent || r.netto_cent > 0 || r.event_key.includes(':correctie:'))) continue
    if (await achterhaald(r)) {
      await billingDb.from('arnobot_referral_grootboek').update({ mail_at: nu.toISOString() }).eq('id', r.id).is('mail_at', null)
      continue
    }
    await eenKeer('arnobot_referral_grootboek', r.id, r.aanbrenger_user_id, type,
      r.netto_cent === null ? {} : { bedragCent: Math.abs(r.netto_cent) })
  }
  return uit
}
