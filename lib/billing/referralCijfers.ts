import * as Sentry from '@sentry/nextjs'
import { billingDb } from './db'
import { betaaldeTeamsVan, eigenBetalingStaat, laadDossier, type Dossier, type GrootboekRegel } from './referralGrootboek'
import { saldoVan } from './referralSaldo'
import { MEELOOP } from './referralStand'
import { isGratisAccount } from '@/lib/gratisAccount'

// De tellers BETALEND en TEGOED in het referralblok op de accountpagina. Ze rekenen met dezelfde gegevens als het
// grootboek. Niet met approved_users.referral_credit (met de hand bijgehouden) en niet alleen met status 'converted'
// (alleen Pro), want daarmee klopten ze niet. null: nu niet te berekenen, dan toont het blok die teller niet.

export interface ReferralCijfers {
  betalend: number | null
  /** Exclusief btw. */
  tegoedCent: number | null
}

/** Heeft deze aangebrachte klant betaald, en staat die betaling nog? */
function heeftBetaald(d: Dossier, geconverteerd: boolean): boolean {
  if (d.betalingen.some(eigenBetalingStaat) || betaaldeTeamsVan(d).length > 0) return true
  // Buiten Mollie om (met de hand op BETAALD). Zijn er online betalingen die niet (meer) staan, dan beslissen die.
  if (isGratisAccount(d.gebruiker) || d.betalingen.some(b => b.status === 'paid') || d.facturen.length > 0) return false
  return geconverteerd || (d.ooitMetDeHandBetaald && !!d.gebruiker.paid_at)
}

async function telBetalend(userId: string): Promise<number> {
  const { data, error } = await billingDb.from('arnobot_referrals').select('referred_user_id, status').eq('referrer_user_id', userId).limit(1000)
  if (error) throw new Error(`referrals ophalen mislukt: ${error.message}`)
  const rijen = (data ?? []) as { referred_user_id: string; status: string }[]
  let aantal = 0
  // Tien tegelijk: wie veel mensen aanbracht hoeft niet per klant op de vorige te wachten.
  for (let i = 0; i < rijen.length; i += 10) {
    const uitslagen = await Promise.all(rijen.slice(i, i + 10).map(async r => {
      const d = await laadDossier(r.referred_user_id)
      return !!d && heeftBetaald(d, r.status === 'converted')
    }))
    aantal += uitslagen.filter(Boolean).length
  }
  return aantal
}

async function telTegoed(userId: string): Promise<number> {
  const { data, error } = await billingDb.from('arnobot_referral_grootboek').select('*').eq('aanbrenger_user_id', userId).limit(1000)
  if (error) throw new Error(`grootboek ophalen mislukt: ${error.message}`)
  // Zolang het grootboek meeloopt staan de toekenningen in de meeloopregels.
  return saldoVan(((data ?? []) as GrootboekRegel[]).filter(r => r.meeloop === MEELOOP)).beschikbaarCent
}

const ofNiets = (taak: Promise<number>) => taak.catch(e => {
  Sentry.captureException(e, { tags: { onderdeel: 'referral-cijfers' } })
  return null
})

export async function referralCijfers(userId: string): Promise<ReferralCijfers> {
  const [betalend, tegoedCent] = await Promise.all([ofNiets(telBetalend(userId)), ofNiets(telTegoed(userId))])
  return { betalend, tegoedCent }
}
