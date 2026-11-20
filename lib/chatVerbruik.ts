// Tokenverbruik van één chatbeurt (alle aanroepen bij elkaar: het antwoord, de toolrondes en een eventueel vervolg na max_tokens),
// bewaard in arnobot_rds_logs.verbruik (docs/sql/2026-11-19-chat-verbruik.sql). Aanleiding: bijlagen worden bij elke beurt
// opnieuw als invoer meegestuurd en er was nergens zichtbaar wat dat kost of of prompt caching raak is
// (docs/DOCUMENTEN_PLAN.md, "Kosten en prompt caching op bijlagen"). Bevat alleen aantallen, nooit inhoud.

export type ChatVerbruik = {
  /** Invoertokens die niet uit of in de cache gingen. */
  invoer: number
  cache_schrijven: number
  cache_lezen: number
  uitvoer: number
  /** Aantal aanroepen naar het model in deze beurt (1 + toolrondes + vervolg). */
  aanroepen: number
  /** Aantal bijlageblokken (PDF, afbeelding) dat in deze beurt meeging. */
  bijlagen: number
  /** Antwoordlengte die de server toepaste (KORT, NORMAAL of UITGEBREID). Ontbreekt bij beurten van voor 2026-11-20. */
  lengte?: 'kort' | 'normaal' | 'uitgebreid'
  /** Alleen gezet als de gebruiker iets anders vroeg dan de server toepaste (UITGEBREID aangeklikt zonder Pro). */
  gevraagd?: string
  /** Alleen bij een beurt via de lezer (lib/documentLezer.ts): het verbruik van die aparte, goedkopere aanroepen (ander model, ander tarief). */
  lezer?: { invoer: number; cache_schrijven: number; cache_lezen: number; uitvoer: number; aanroepen: number }
}

type UsageDeel = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

export function maakVerbruik(bijlagen: number = 0): ChatVerbruik {
  return { invoer: 0, cache_schrijven: 0, cache_lezen: 0, uitvoer: 0, aanroepen: 0, bijlagen }
}

/** Telt één aanroep op bij het totaal. Een ontbrekende of onvolledige usage telt als nul en laat de beurt nooit falen. */
export function telOp(totaal: ChatVerbruik, usage: UsageDeel | null | undefined): void {
  totaal.aanroepen += 1
  if (!usage) return
  totaal.invoer += usage.input_tokens ?? 0
  totaal.cache_schrijven += usage.cache_creation_input_tokens ?? 0
  totaal.cache_lezen += usage.cache_read_input_tokens ?? 0
  totaal.uitvoer += usage.output_tokens ?? 0
}

/** Telt één aanroep van de lezer op, apart van het hoofdverbruik. Werkt het veld `lezer` pas bij op de eerste aanroep bij. */
export function telOpLezer(totaal: ChatVerbruik, usage: UsageDeel | null | undefined): void {
  const l = (totaal.lezer ??= { invoer: 0, cache_schrijven: 0, cache_lezen: 0, uitvoer: 0, aanroepen: 0 })
  l.aanroepen += 1
  if (!usage) return
  l.invoer += usage.input_tokens ?? 0
  l.cache_schrijven += usage.cache_creation_input_tokens ?? 0
  l.cache_lezen += usage.cache_read_input_tokens ?? 0
  l.uitvoer += usage.output_tokens ?? 0
}

/** Kosten in dollars bij de gegeven prijzen per 1M tokens (cache schrijven 1,25 keer, cache lezen 0,1 keer de invoerprijs). */
export function verbruikKostenUsd(v: ChatVerbruik, invoerPerMiljoen: number, uitvoerPerMiljoen: number): number {
  return (
    v.invoer * invoerPerMiljoen
    + v.cache_schrijven * invoerPerMiljoen * 1.25
    + v.cache_lezen * invoerPerMiljoen * 0.1
    + v.uitvoer * uitvoerPerMiljoen
  ) / 1_000_000
}
