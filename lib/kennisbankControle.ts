// Beoordeling van de gezondheid van de kennisbank (blog_chunks). Puur, zodat het testbaar is.
// Aanleiding: op 2026-11-01 bleek een ivfflat-index (standaard probes=1) de zoekstap te beperken
// tot ongeveer 1% van de fragmenten (4 tot 34 kandidaten in plaats van 100), zonder dat iemand het
// merkte omdat er altijd wel iets terugkwam. Zie docs/OPENSTAANDE_PUNTEN.md.

// Ondergrens aan het totaal aantal fragmenten (nu ongeveer 1540). Valt het ver daaronder, dan is er
// waarschijnlijk iets gewist.
export const MIN_FRAGMENTEN = 1400
// Een gewone vraag levert nu 100 kandidaten (match_count). Onder de 60 is de zoekstap beperkt.
export const MIN_KANDIDATEN = 60

export type KennisbankMeting = {
  totaal: number
  zonderEmbedding: number
  kandidaten: number[]
}

export function beoordeelKennisbank(m: KennisbankMeting): string[] {
  const problemen: string[] = []
  if (m.totaal < MIN_FRAGMENTEN) problemen.push(`Nog maar ${m.totaal} fragmenten in de kennisbank (minimaal ${MIN_FRAGMENTEN} verwacht), is er iets gewist?`)
  if (m.zonderEmbedding > 0) problemen.push(`${m.zonderEmbedding} fragment(en) zonder embedding, die zijn niet vindbaar.`)
  const laag = m.kandidaten.filter(n => n < MIN_KANDIDATEN)
  if (laag.length > 0) {
    problemen.push(`De zoekstap levert te weinig kandidaten: ${m.kandidaten.join(', ')} (minimaal ${MIN_KANDIDATEN} verwacht, normaal 100). Is er een index of instelling aangepast?`)
  }
  return problemen
}
