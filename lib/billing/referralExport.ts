import type { SupabaseClient } from '@supabase/supabase-js'
import { tabelOntbreekt } from './tabel'

// De regels uit het referralgrootboek voor de gegevensexport van een gebruiker (/api/bot/export).
// Bewust zonder het id van de andere persoon, diens maandprijs en de reden: die zeggen iets over diens abonnement en
// betaalgedrag (AVG artikel 15 lid 4).

type Rij = { created_at: string; soort: string; netto_cent: number | null; meeloop: boolean }

export async function exporteerGrootboek(db: SupabaseClient, userId: string) {
  const lees = async (kolom: 'aanbrenger_user_id' | 'klant_user_id') => {
    const { data, error } = await db
      .from('arnobot_referral_grootboek')
      .select('created_at, soort, netto_cent, meeloop')
      .eq(kolom, userId)
      .order('created_at', { ascending: true })
      .limit(1000)
    if (error) {
      if (tabelOntbreekt(error)) return []
      throw new Error(`referralgrootboek ophalen mislukt: ${error.message}`)
    }
    return (data ?? []) as Rij[]
  }
  const [alsAanbrenger, alsNieuw] = await Promise.all([lees('aanbrenger_user_id'), lees('klant_user_id')])
  return {
    als_aanbrenger: alsAanbrenger,
    // Het bedrag is het tegoed van de aanbrenger, niet van jou.
    als_nieuwe_gebruiker: alsNieuw.map(({ created_at, soort, meeloop }) => ({ created_at, soort, meeloop })),
  }
}
