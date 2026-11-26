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
  // Alleen JJJJ-MM-DD, eventueel met tijd: 01-12-2026 zou anders als 12 januari gelezen worden en oud werk doorlaten.
  const ingesteld = process.env.REFERRAL_MAILS_VANAF ?? ''
  const vanaf = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/.test(ingesteld) ? Date.parse(ingesteld) : NaN
  if (!Number.isFinite(vanaf)) return uit
  // De ondergrens gaat ook de zoekvraag in: anders verdringen oude, nooit gemailde rijen de nieuwe uit de eerste 200.
  const ondergrensMs = Math.max(vanaf, nu.getTime() - MAIL_VENSTER_DAGEN * 24 * 60 * 60 * 1000)
  const ondergrens = new Date(ondergrensMs).toISOString()
  const recent = (iso?: string) => !!iso && Date.parse(iso) >= ondergrensMs

  async function eenKeer(tabel: string, id: string, userId: string, type: EmailType, billing: Parameters<typeof verstuurBillingMail>[2]) {
    const { data, error } = await billingDb.from(tabel).update({ mail_at: nu.toISOString() }).eq('id', id).is('mail_at', null).select('id')
    if (error) throw new Error(`mail claimen mislukt: ${error.message}`)
    if (data?.length !== 1) return
    if (await verstuurBillingMail(userId, type, billing)) { uit.verstuurd++; return }
    uit.mislukt++
    await billingDb.from(tabel).update({ mail_at: null }).eq('id', id)
  }

  const { data: acties, error: actieFout } = await billingDb.from('arnobot_referral_acties').select('*').eq('status', 'bevestigd')
    .is('mail_at', null).gte('updated_at', ondergrens).order('updated_at', { ascending: true }).limit(1000)
  if (actieFout) throw new Error(`referralacties ophalen mislukt: ${actieFout.message}`)
  for (const a of (acties ?? []) as MetMail<ActieRij>[]) {
    // Met de hand ingeboekt is geen terugstorting van ons: daar hoort geen mail bij.
    // Het venster telt vanaf de bevestiging: na lang wachten bij Mollie hoort de mail er alsnog bij. Zonder dat moment
    // (met de hand bevestigd in de database) telt de dag van aanmaken.
    // referral_bevestig_met_de_hand legt geen bevestigingsmoment vast: dan telt de laatste wijziging. mail_at houdt het bij een.
    const gegevens = a.gegevens as (ActieRij['gegevens'] & { bevestigd_met_de_hand?: boolean }) | undefined
    const bevestigd = gegevens?.bevestigd_at ?? (gegevens?.bevestigd_met_de_hand ? a.updated_at : a.created_at)
    if (!recent(bevestigd) || isInternalTestUser(a.user_id) || a.doel_id.startsWith('handmatig:')) continue
    await eenKeer('arnobot_referral_acties', a.id, a.user_id, a.soort.startsWith('voordeel') ? 'referral_voordeel' : 'referral_tegoed_verrekend',
      { bedragCent: a.bruto_cent, reden: REDEN[a.soort] })
  }

  // Over meeloopregels gaat nooit een mail uit.
  if (MEELOOP) return uit
  const { data: regels, error: regelFout } = await billingDb.from('arnobot_referral_grootboek').select('*').eq('meeloop', false)
    .is('mail_at', null).in('soort', Object.keys(REGEL_MAIL)).gte('created_at', ondergrens).order('created_at', { ascending: true }).limit(1000)
  if (regelFout) throw new Error(`grootboek ophalen mislukt: ${regelFout.message}`)
  const regelsVan = async (referralId: string): Promise<GrootboekRegel[]> => {
    const { data, error } = await billingDb.from('arnobot_referral_grootboek').select('*').eq('meeloop', false).eq('referral_id', referralId)
    if (error) throw new Error(`grootboek ophalen mislukt: ${error.message}`)
    return (data ?? []) as GrootboekRegel[]
  }
  /** Toegekend zonder dat het bedrag ooit vaststond ("bedrag volgt"): verval en terugdraaiing zijn dan 0, maar wel nieuws. */
  const bedragNooitBekend = (alle: GrootboekRegel[]) => alle.some(x => x.soort === 'toekenning' && x.netto_cent === null)
    && !alle.some(x => x.soort === 'vaststelling')
  /** Is dit bericht al achterhaald door een latere regel? Dan niet versturen. */
  const achterhaald = async (r: GrootboekRegel, alle: GrootboekRegel[]): Promise<boolean> => {
    if (r.soort === 'verval') return false
    const teruggedraaid = isTeruggedraaid(alle, r.referral_id)
    // Een toekenning die al teruggedraaid of vervallen is, en een terugdraaiing die al hersteld is.
    return r.soort === 'toekenning'
      ? teruggedraaid || alle.some(x => x.soort === 'verval' && ((!!x.netto_cent && x.netto_cent < 0) || bedragNooitBekend(alle)))
      : !teruggedraaid
  }
  for (const r of (regels ?? []) as MetMail<GrootboekRegel>[]) {
    const type = REGEL_MAIL[r.soort]
    if (!type || !recent(r.created_at) || isInternalTestUser(r.aanbrenger_user_id)) continue
    // De correcties bij een bevestiging met de hand zijn geen bericht.
    if (r.soort !== 'toekenning' && ((r.netto_cent ?? 0) > 0 || r.event_key.includes(':correctie:'))) continue
    const alle = await regelsVan(r.referral_id)
    // Een verval of terugdraaiing van niets is geen bericht waard, behalve als het bedrag nog niet vaststond. Was het
    // tegoed al teruggedraaid, dan is dat het bericht en volgt er geen tweede over verval.
    if (r.soort !== 'toekenning' && !r.netto_cent && (!bedragNooitBekend(alle) || (r.soort === 'verval' && isTeruggedraaid(alle, r.referral_id)))) continue
    if (await achterhaald(r, alle)) {
      await billingDb.from('arnobot_referral_grootboek').update({ mail_at: nu.toISOString() }).eq('id', r.id).is('mail_at', null)
      continue
    }
    await eenKeer('arnobot_referral_grootboek', r.id, r.aanbrenger_user_id, type,
      r.netto_cent === null || (r.soort !== 'toekenning' && !r.netto_cent) ? {} : { bedragCent: Math.abs(r.netto_cent) })
  }
  return uit
}
