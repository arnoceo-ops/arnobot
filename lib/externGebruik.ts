// Meting van de betaalde diensten naast Anthropic die per gebruiker kosten maken: Voyage (zoeken en herordenen, tokens uit de respons),
// OpenAI-transcriptie (dicteren) en AssemblyAI (audiobijlagen, duur uit de respons). Zelfde tabel als lib/aiGebruik.ts (arnobot_ai_gebruik),
// zelfde regels: alleen aantallen, fail-open. ElevenLabs staat al per aanroep in arnobot_elevenlabs_usage (tekens) en wordt daar gelezen.
import type { AiGebruikRij } from '@/lib/aiGebruik'
import { houdInLeven, schrijfAiGebruik } from '@/lib/gebruikOpslag'

// Dollars per miljoen tokens. Alleen waar het getal in de repo is geverifieerd: rerank-2.5 staat in lib/kostenTarieven.ts
// (docs.voyageai.com/docs/pricing, gelezen 2026-11-16). De embedding-modellen hebben hier geen geverifieerd tarief en krijgen kosten null
// (de tokens staan er wel), zodat het in het overzicht opvalt in plaats van als nul te tellen.
const VOYAGE_PER_MILJOEN_USD: Record<string, number> = { 'rerank-2.5': 0.05 }
// Dollars per uur audio (lib/kostenTarieven.ts: universal-3-5-pro $0,21 plus diarization $0,02) en per minuut dicteren (gpt-transcribe).
const ASSEMBLYAI_PER_UUR_USD = 0.23
const OPENAI_TRANSCRIBE_PER_MINUUT_USD = 0.0045

export function voyageKostenUsd(model: string, tokens: number): number | null {
  const p = VOYAGE_PER_MILJOEN_USD[model]
  return p === undefined ? null : (tokens * p) / 1_000_000
}

const leeg = { cache_schrijven: 0, cache_lezen: 0, uitvoer: 0 }

/** De rij voor één Voyage-aanroep, of null als de respons geen usage bevat (dan valt er niets te meten). */
export function voyageRij(json: unknown, model: string, gebruiker: string | null | undefined, bron: string): AiGebruikRij | null {
  const tokens = (json as { usage?: { total_tokens?: number } } | null)?.usage?.total_tokens
  if (typeof tokens !== 'number' || tokens <= 0) return null
  return { user_id: gebruiker || null, bron, model, invoer: tokens, ...leeg, kosten_usd: voyageKostenUsd(model, tokens), afgebroken: false, leverancier: 'voyage' }
}

export function assemblyAiRij(seconden: number, gebruiker: string | null | undefined, bron: string): AiGebruikRij | null {
  if (!(seconden > 0)) return null
  return {
    user_id: gebruiker || null, bron, model: 'universal-3-5-pro', invoer: 0, ...leeg,
    kosten_usd: (seconden / 3600) * ASSEMBLYAI_PER_UUR_USD, afgebroken: false, leverancier: 'assemblyai', hoeveelheid: seconden, eenheid: 'seconden',
  }
}

type OpenAiUsage = { type?: string; seconds?: number; input_tokens?: number; output_tokens?: number }

/**
 * Leest uit een OpenAI-transcriptiestroom (SSE) het usage-blok van de afsluitende gebeurtenis. De duur ('seconds') geeft kosten tegen het
 * minuuttarief; geeft OpenAI tokens, dan staan die in de rij zonder kosten (geen geverifieerd tarief per token).
 */
export function openAiTranscriptieRij(sse: string, gebruiker: string | null | undefined, bron: string): AiGebruikRij | null {
  let usage: OpenAiUsage | null = null
  for (const regel of sse.split(/\r?\n/)) {
    if (!regel.startsWith('data:')) continue
    try {
      const ev = JSON.parse(regel.slice(5).trim()) as { type?: string; usage?: OpenAiUsage }
      if (ev.type === 'transcript.text.done' && ev.usage) usage = ev.usage
    } catch {
      // geen JSON (bijvoorbeeld [DONE]): overslaan
    }
  }
  if (!usage) return null
  const seconden = typeof usage.seconds === 'number' ? usage.seconds : null
  const invoer = usage.input_tokens ?? 0
  const uitvoer = usage.output_tokens ?? 0
  if (seconden === null && invoer + uitvoer === 0) return null
  return {
    user_id: gebruiker || null, bron, model: 'gpt-transcribe', invoer, cache_schrijven: 0, cache_lezen: 0, uitvoer,
    kosten_usd: seconden === null ? null : (seconden / 60) * OPENAI_TRANSCRIBE_PER_MINUUT_USD,
    afgebroken: false, leverancier: 'openai', hoeveelheid: seconden, eenheid: seconden === null ? null : 'seconden',
  }
}

/** Schrijft een rij weg zonder de aanroeper te laten wachten of falen. */
export function meldGebruik(rij: AiGebruikRij | null): void {
  if (!rij) return
  try {
    houdInLeven(schrijfAiGebruik(rij))
  } catch {
    // meting mislukt: de aanroep zelf gaat gewoon door
  }
}

/** Zoals meldGebruik, voor een rij die pas na afloop van een stroom bekend is. */
export function meldGebruikLater(rij: Promise<AiGebruikRij | null>): void {
  try {
    houdInLeven(rij.then(r => (r ? schrijfAiGebruik(r) : undefined)).catch(() => {}))
  } catch {
    // meting mislukt: de aanroep zelf gaat gewoon door
  }
}

export function meldVoyage(json: unknown, model: string, gebruiker: string | null | undefined, bron: string): void {
  meldGebruik(voyageRij(json, model, gebruiker, bron))
}
