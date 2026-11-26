import type { SupabaseClient } from '@supabase/supabase-js'
import { tabelOntbreekt } from './tabel'

// De regels uit het referralgrootboek voor de gegevensexport van een gebruiker (/api/bot/export).
// Bewust zonder het id van de andere persoon, diens maandprijs en de reden: die zeggen iets over diens abonnement en
// betaalgedrag (AVG artikel 15 lid 4).

type ReferralRij = Record<string, unknown> & { referrer_user_id?: string; referred_user_id?: string }

const kies = (r: ReferralRij, velden: string[]) => Object.fromEntries(velden.filter(v => v in r).map(v => [v, r[v]]))

/** De rijen uit arnobot_referrals met per persoon alleen de eigen gegevens: nooit het id, de naam of de korting van de ander. */
export function eigenReferralGegevens(rijen: ReferralRij[], userId: string) {
  return rijen.map(r => r.referred_user_id === userId
    ? { rol: 'nieuwe gebruiker', ...kies(r, ['created_at', 'code_used', 'referred_naam', 'status', 'referred_discount']) }
    : { rol: 'aanbrenger', ...kies(r, ['created_at', 'code_used', 'notif_sent_at']) })
}

type Rij = { created_at: string; soort: string; netto_cent: number | null; meeloop: boolean; klant_maand_netto_cent: number | null }

export async function exporteerGrootboek(db: SupabaseClient, userId: string) {
  const lees = async (kolom: 'aanbrenger_user_id' | 'klant_user_id') => {
    const { data, error } = await db
      .from('arnobot_referral_grootboek')
      .select(kolom === 'aanbrenger_user_id' ? 'created_at, soort, netto_cent, meeloop' : 'created_at, soort, meeloop, klant_maand_netto_cent')
      .eq(kolom, userId)
      .order('created_at', { ascending: true })
      .limit(1000)
    if (error) {
      if (tabelOntbreekt(error)) return []
      throw new Error(`referralgrootboek ophalen mislukt: ${error.message}`)
    }
    return (data ?? []) as unknown as Rij[]
  }
  const [alsAanbrenger, alsNieuw] = await Promise.all([lees('aanbrenger_user_id'), lees('klant_user_id')])
  return {
    als_aanbrenger: alsAanbrenger,
    // Alleen wat over het eigen abonnement gaat. Afwijzen en vervallen zeggen iets over de aanbrenger.
    als_nieuwe_gebruiker: alsNieuw.filter(r => r.soort === 'toekenning')
      .map(({ created_at, meeloop, klant_maand_netto_cent }) => ({ created_at, meeloop, jouw_maandprijs_netto_cent: klant_maand_netto_cent })),
  }
}
