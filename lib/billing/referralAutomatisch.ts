import { billingDb } from './db'
import { tabelOntbreekt } from './tabel'
import { schakelaarAan } from './referralSchakelaars'
import { TERUGSTORT_OMSCHRIJVING } from './referralTeksten'
import { MEELOOP } from './referralStand'
import type { ReserveerInvoer } from './referralTerugstorten'

// Kleine vragen over de stand van de automatisering, ook gebruikt vanuit de betaalverwerking (de signalen aan Arno).
// Daarom zonder de planner te laden.

type DbFout = { code?: string; message: string }
export const actieTabelOntbreekt = (e: DbFout) => e.code === '42P01' || e.code === 'PGRST205' || tabelOntbreekt(e)

/** false: de SQL is niet uitgevoerd. Een andere fout wordt doorgegeven. */
export async function actieTabelBestaat(): Promise<boolean> {
  const { error } = await billingDb.from('arnobot_referral_acties').select('id').limit(1)
  if (!error) return true
  if (actieTabelOntbreekt(error)) return false
  throw new Error(`referralacties ophalen mislukt: ${error.message}`)
}

/**
 * Doet het systeem dit soort terugstorting zelf? Alleen met de schakelaar aan, de klanttekst vastgesteld en de SQL
 * uitgevoerd, en voor tegoed ook pas als het grootboek echt telt. Tot dan blijven de signalen om het met de hand te doen.
 */
export async function gaatAutomatisch(soort: ReserveerInvoer['soort']): Promise<boolean> {
  if (!schakelaarAan('REFERRAL_TERUGSTORTEN') || !TERUGSTORT_OMSCHRIJVING[soort]) return false
  if (soort === 'tegoed_terugstorten' && MEELOOP) return false
  return actieTabelBestaat()
}

/** Staat er voor deze referral al een voordeel klaar, onderweg of gegeven (ook met de hand ingeboekt)? */
export async function heeftVoordeelActie(referralId: string): Promise<boolean> {
  const { data, error } = await billingDb.from('arnobot_referral_acties').select('id, soort, status')
    .eq('referral_id', referralId).limit(50)
  if (error) {
    if (actieTabelOntbreekt(error)) return false
    throw new Error(`referralacties ophalen mislukt: ${error.message}`)
  }
  return ((data ?? []) as { soort: string; status: string }[])
    .some(a => a.soort.startsWith('voordeel') && a.status !== 'vrijgegeven' && a.status !== 'ongedaan')
}
