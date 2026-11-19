// Wat elke gebruiker deze kalendermaand (Amsterdamse tijd) aan AI en spraak kost, voor de beheerpagina (/bot/admin/gebruikers).
// Bron: arnobot_ai_gebruik (Anthropic, Voyage, OpenAI-dicteren, AssemblyAI; gevuld door lib/aiGebruik.ts en lib/externGebruik.ts) en
// arnobot_elevenlabs_usage (tekens). De leverancier wordt uit de modelnaam afgeleid zodat dit ook werkt voordat de kolom leverancier bestaat.
// Het is een ondergrens: alleen wat gemeten wordt. Rijen zonder prijs (nieuw model, embedding zonder geverifieerd tarief) tellen als nul
// in de euro's en worden apart geteld, zodat zichtbaar is dat er iets ontbreekt.
import type { SupabaseClient } from '@supabase/supabase-js'
import { haalAlleRijen } from '@/lib/haalAlleRijen'
import { amsterdamMaandStart } from '@/lib/voiceLimiet'
import { VOICE_USD_PER_1000_TEKENS } from '@/lib/maandKosten'
import { MANUAL_TEST_USER_ID, isInternalTestUser } from '@/lib/internalTestAccounts'

/** Referentieprijs per maand in euro bij jaarbetaling (docs/ABONNEMENTEN.md): alleen om de kostenkolom in de admin te kleuren, niet de echte factuur. */
export const REFERENTIE_PRIJS_EUR: Record<string, number> = { basis: 19, premium: 39, team: 49 }

/**
 * Gebruikers die de Abacus-tab Gebruikers niet toont (besluit Arno 2026-11-19: "haal alle testers eruit behalve mijn eigen account en mijn
 * testaccount"): de interne testaccounts en de nepleden uit de demo, behalve Arno's handmatige testaccount, plus externe testers op user-ID.
 * Hun kosten verdwijnen niet: de tab toont ze als één regel, zodat het totaal naar de Anthropic-Console te herleiden blijft.
 */
export const ABACUS_EXTERNE_TESTERS_USER_IDS: readonly string[] = [
  'user_3EiyfRK85W4Vx4ebqbxbTys79LC', // externe tester, Team Hippios
]
export function isTesterVoorAbacus(userId: string): boolean {
  if (ABACUS_EXTERNE_TESTERS_USER_IDS.includes(userId)) return true
  return isInternalTestUser(userId) && userId !== MANUAL_TEST_USER_ID
}

export type GebruikerKosten = {
  totaalUsd: number
  anthropicUsd: number
  voyageUsd: number
  audioUsd: number
  voiceUsd: number
  /** Aantal gemeten aanroepen zonder bekend tarief (kosten staan dan op nul). */
  zonderPrijs: number
}

export type KostenRij = { user_id: string | null; model: string | null; kosten_usd: number | string | null }

export function leverancierUitModel(model: string | null): 'anthropic' | 'voyage' | 'audio' | 'onbekend' {
  if (!model) return 'onbekend'
  if (model.startsWith('claude-')) return 'anthropic'
  if (model.startsWith('voyage') || model.startsWith('rerank')) return 'voyage'
  if (model.startsWith('universal') || model.startsWith('gpt-')) return 'audio'
  return 'onbekend'
}

const leeg = (): GebruikerKosten => ({ totaalUsd: 0, anthropicUsd: 0, voyageUsd: 0, audioUsd: 0, voiceUsd: 0, zonderPrijs: 0 })

/** Telt de gemeten rijen en de ElevenLabs-tekens op per gebruiker. Rijen zonder gebruiker (platformwerk) tellen niet mee. */
export function somKostenPerGebruiker(rijen: KostenRij[], voice: { user_id: string | null; char_count: number | null }[]): Map<string, GebruikerKosten> {
  const uit = new Map<string, GebruikerKosten>()
  const van = (id: string) => uit.get(id) ?? (uit.set(id, leeg()), uit.get(id)!)
  for (const r of rijen) {
    if (!r.user_id) continue
    const k = van(r.user_id)
    if (r.kosten_usd === null || r.kosten_usd === undefined) { k.zonderPrijs++; continue }
    const usd = Number(r.kosten_usd)
    if (!isFinite(usd)) continue
    const soort = leverancierUitModel(r.model)
    if (soort === 'voyage') k.voyageUsd += usd
    else if (soort === 'audio') k.audioUsd += usd
    else k.anthropicUsd += usd
    k.totaalUsd += usd
  }
  for (const v of voice) {
    if (!v.user_id) continue
    const usd = ((v.char_count ?? 0) / 1000) * VOICE_USD_PER_1000_TEKENS
    const k = van(v.user_id)
    k.voiceUsd += usd
    k.totaalUsd += usd
  }
  return uit
}

export async function haalGebruikerKosten(db: SupabaseClient, nu: Date = new Date()): Promise<Map<string, GebruikerKosten>> {
  const vanaf = amsterdamMaandStart(nu)
  const [rijen, voice] = await Promise.all([
    haalAlleRijen<KostenRij>((van, tot) =>
      db.from('arnobot_ai_gebruik').select('user_id, model, kosten_usd')
        .gte('created_at', vanaf).not('user_id', 'is', null)
        .order('id', { ascending: true }).range(van, tot)),
    haalAlleRijen<{ user_id: string | null; char_count: number | null }>((van, tot) =>
      db.from('arnobot_elevenlabs_usage').select('user_id, char_count')
        .gte('created_at', vanaf)
        .order('id', { ascending: true }).range(van, tot)),
  ])
  return somKostenPerGebruiker(rijen, voice)
}
