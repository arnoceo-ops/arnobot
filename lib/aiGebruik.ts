// Meting van elke Anthropic-aanroep per gebruiker en per bron, op één plek: een middleware van de SDK (zie lib/anthropicClient.ts).
// Aanleiding (besluit Arno 2026-11-19): een chatbericht bleek ongeveer $0,10 te kosten, niet de $0,015 uit Abacus, en per gebruiker was
// niet te zien wat er werd uitgegeven; alleen de hoofdchat logde verbruik (arnobot_rds_logs.verbruik). Elke aanroep die via de fabriek
// loopt komt nu in arnobot_ai_gebruik, ook als de aanroeper geen gebruiker meegeeft (dan staat user_id leeg, bron 'onbekend' of de
// opgegeven bron, zodat de som altijd naar de Anthropic-Console te herleiden is). Bevat alleen aantallen, nooit inhoud.
// Alles hier is fail-open: een fout in de meting mag een aanroep nooit laten falen of de respons aanraken.
import type { Middleware } from '@anthropic-ai/sdk'

/** Interne headers waarmee een aanroeper de gebruiker en de bron meegeeft. De middleware haalt ze eraf voordat het verzoek naar Anthropic gaat. */
export const AI_HEADER_GEBRUIKER = 'x-arnobot-gebruiker'
export const AI_HEADER_BRON = 'x-arnobot-bron'
export const AI_ONBEKENDE_BRON = 'onbekend'

export type AiTokens = { invoer: number; cache_schrijven: number; cache_lezen: number; uitvoer: number }

export type AiGebruikRij = AiTokens & {
  user_id: string | null
  bron: string
  model: string | null
  /** Dollars volgens de prijslijst hieronder, null voor een model zonder bekende prijs (de tokens staan er dan wel). */
  kosten_usd: number | null
  /** De stroom brak af voordat het einde kwam: de aantallen zijn dan wat tot dat moment bekend was. */
  afgebroken: boolean
}

// Dollars per miljoen tokens (invoer, uitvoer). Sonnet 4.6 en Haiku 4.5 staan in lib/kostenTarieven.ts en lib/maandKosten.ts; Fable 5.1 in
// lib/kostenTarieven.ts (geverifieerd 2026-09-29). Een model dat hier ontbreekt krijgt kosten_usd null en valt zo op in het overzicht.
const PRIJZEN_PER_MILJOEN: Record<string, { invoer: number; uitvoer: number }> = {
  'claude-sonnet-4-6': { invoer: 3, uitvoer: 15 },
  'claude-haiku-4-5-20251001': { invoer: 1, uitvoer: 5 },
  'claude-fable-5-1': { invoer: 10, uitvoer: 50 },
}

/** Cache schrijven (5 minuten) kost 1,25 keer de invoerprijs, cache lezen 0,1 keer. */
export function aiKostenUsd(model: string | null, t: AiTokens): number | null {
  const p = model ? PRIJZEN_PER_MILJOEN[model] : undefined
  if (!p) return null
  return (t.invoer * p.invoer + t.cache_schrijven * p.invoer * 1.25 + t.cache_lezen * p.invoer * 0.1 + t.uitvoer * p.uitvoer) / 1_000_000
}

/** Opties voor een aanroep (tweede argument van messages.create of messages.stream): zo weet de meting van wie en waarvoor het is. */
export function aiContext(userId: string | null | undefined, bron: string): { headers: Record<string, string> } {
  const headers: Record<string, string> = { [AI_HEADER_BRON]: bron }
  if (userId) headers[AI_HEADER_GEBRUIKER] = userId
  return { headers }
}

type UsageDeel = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

export type AiTeller = { model: string | null; tokens: AiTokens }

export function maakAiTeller(): AiTeller {
  return { model: null, tokens: { invoer: 0, cache_schrijven: 0, cache_lezen: 0, uitvoer: 0 } }
}

/** Anthropic meldt in een stroom oplopende totalen (message_start en daarna message_delta): per veld telt het hoogste getal. */
export function verwerkUsage(t: AiTokens, u: UsageDeel | null | undefined): void {
  if (!u) return
  t.invoer = Math.max(t.invoer, u.input_tokens ?? 0)
  t.cache_schrijven = Math.max(t.cache_schrijven, u.cache_creation_input_tokens ?? 0)
  t.cache_lezen = Math.max(t.cache_lezen, u.cache_read_input_tokens ?? 0)
  t.uitvoer = Math.max(t.uitvoer, u.output_tokens ?? 0)
}

/** Verwerkt één SSE-gebeurtenis van een stroom: de modelnaam en usage staan in message_start, de eindstand van de uitvoer in message_delta. */
export function verwerkStreamEvent(teller: AiTeller, ev: unknown): void {
  if (!ev || typeof ev !== 'object') return
  const e = ev as { type?: string; message?: { model?: string; usage?: UsageDeel }; usage?: UsageDeel }
  if (e.type === 'message_start') {
    if (e.message?.model) teller.model = e.message.model
    verwerkUsage(teller.tokens, e.message?.usage)
  } else if (e.type === 'message_delta') {
    verwerkUsage(teller.tokens, e.usage)
  }
}

export type AiSchrijver = (rij: AiGebruikRij) => Promise<unknown> | unknown
/** Houdt een achtergrondtaak in leven tot hij klaar is (in productie after() van Next, zodat de functie niet bevriest voor de rij is weggeschreven). */
export type AiUitsteller = (taak: Promise<unknown>) => void

const heeftTokens = (t: AiTokens) => t.invoer + t.cache_schrijven + t.cache_lezen + t.uitvoer > 0

/**
 * De middleware: laat het verzoek ongemoeid door (alleen onze twee interne headers gaan eraf), kijkt via de eigen, onafhankelijke kopie van de
 * respons mee en schrijft na afloop één rij. Alleen POST /v1/messages (geen count_tokens, geen mislukte aanroepen: die worden niet gefactureerd).
 */
export function maakAiMeter(schrijf: AiSchrijver, uitstellen: AiUitsteller = () => {}): Middleware {
  return async (request, next, ctx) => {
    const gebruiker = request.headers.get(AI_HEADER_GEBRUIKER)
    const bron = request.headers.get(AI_HEADER_BRON) || AI_ONBEKENDE_BRON
    const schoon = new Headers(request.headers)
    schoon.delete(AI_HEADER_GEBRUIKER)
    schoon.delete(AI_HEADER_BRON)
    const response = await next({ ...request, headers: schoon })

    try {
      if (response.ok && ctx.options?.path === '/v1/messages') {
        const stream = !!ctx.options.stream
        const taak = (async () => {
          const teller = maakAiTeller()
          let afgebroken = false
          try {
            if (stream) {
              const events = await ctx.parse<AsyncIterable<unknown>>(response)
              for await (const ev of events) verwerkStreamEvent(teller, ev)
            } else {
              const data = await ctx.parse<{ model?: string; usage?: UsageDeel } | null>(response)
              if (data?.model) teller.model = data.model
              verwerkUsage(teller.tokens, data?.usage)
            }
          } catch {
            afgebroken = true
          }
          if (!heeftTokens(teller.tokens)) return
          await schrijf({
            user_id: gebruiker || null,
            bron,
            model: teller.model,
            ...teller.tokens,
            kosten_usd: aiKostenUsd(teller.model, teller.tokens),
            afgebroken,
          })
        })().catch(() => {})
        uitstellen(taak)
      }
    } catch {
      // meting mislukt: de aanroep zelf gaat gewoon door
    }
    return response
  }
}
