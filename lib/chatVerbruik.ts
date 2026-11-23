// Tokenverbruik van één chatbeurt (alle aanroepen bij elkaar: het antwoord, de toolrondes en een eventueel vervolg na max_tokens),
// bewaard in arnobot_rds_logs.verbruik (docs/sql/2026-11-19-chat-verbruik.sql). Aanleiding: bijlagen worden bij elke beurt
// opnieuw als invoer meegestuurd en er was nergens zichtbaar wat dat kost of of prompt caching raak is
// (docs/DOCUMENTEN_PLAN.md, "Kosten en prompt caching op bijlagen"). Bevat aantallen en per toolaanroep de naam en een ingekorte invoer
// (zie telTool), nooit de inhoud van een overgeschreven tabel.

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
  /** Toolaanroepen van deze beurt (naam en ingekorte invoer), om een verkeerde kolomkeuze of een overgeslagen tool terug te zien (2026-11-21). */
  tools?: { naam: string; invoer: string; fout?: true }[]
  /** Rondes waarvan de tekst vóór een toolaanroep niet is getoond (werkruis zoals "laat me de tabel overschrijven"), met een kort voorbeeld. Toegevoegd 2026-11-23. */
  weggegooid?: { aantal: number; voorbeeld: string }
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

/** Telt een ronde waarvan de tekst vóór een toolaanroep is weggegooid; bewaart alleen het eerste voorbeeld, ingekort. */
export function telWeggegooid(totaal: ChatVerbruik, tekst: string): void {
  const w = (totaal.weggegooid ??= { aantal: 0, voorbeeld: '' })
  w.aantal += 1
  if (!w.voorbeeld && tekst.trim()) w.voorbeeld = tekst.trim().slice(0, 160)
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

const MAX_TOOLS_BEWAARD = 20
const MAX_TEKENS_INVOER = 300

/**
 * Bewaart een toolaanroep in het verbruik van de beurt. Aanleiding: op 2026-11-20 noemde ArnoBot "groei YTD" uit de verkeerde
 * kolom terwijl de tabeltool beschikbaar was, en alleen het aantal aanroepen was terug te zien, niet wat het model meegaf.
 * De overgeschreven tabel zelf (gegevens van de gebruiker) wordt nooit bewaard, alleen het aantal rijen en de kolomkoppen.
 */
export function telTool(totaal: ChatVerbruik, naam: string, input: unknown, isError: boolean): void {
  const lijst = (totaal.tools ??= [])
  if (lijst.length >= MAX_TOOLS_BEWAARD) return
  let invoer: string
  if (naam === 'schrijf_tabel_over') {
    const i = (input ?? {}) as { kolommen?: unknown; rijen?: unknown }
    const kolommen = Array.isArray(i.kolommen) ? i.kolommen.map(String) : []
    const rijen = Array.isArray(i.rijen) ? i.rijen.length : 0
    invoer = `${rijen} rijen, kolommen: ${kolommen.join(' | ')}`
  } else {
    try { invoer = JSON.stringify(input) ?? '' } catch { invoer = '' }
  }
  lijst.push({ naam, invoer: invoer.slice(0, MAX_TEKENS_INVOER), ...(isError ? { fout: true as const } : {}) })
}
