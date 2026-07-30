// Gedeelde tariefaannames voor de kostencalculator (app/kosten). Eén bron van
// waarheid voor zowel de interactieve calculator (KostenCalculatorClient.tsx,
// forward-looking, met instelbare volume-aannames) als de trackrecord-route
// (api/kosten-tracking, backward-looking, rekent met écht gemeten volumes uit
// Supabase i.p.v. aannames, maar gebruikt dezelfde $-tarieven per eenheid).
//
// Bij een tariefwijziging (na de kwartaalcheck, zie CLAUDE.md): dit is het
// enige bestand dat aangepast hoeft te worden.

export type Tier = { name: string; credits: number; price: number }

export const TARIEVEN = {
  // Hoofdchat (Sonnet 4.6 + Haiku-RAG-herschrijving), $ per bericht
  anthropicPerBericht: 0.015,
  // Analyses (voorheen "BIEB", app/api/bot/coaching-analyse, Sonnet 4.6)
  kostenPerAnalyse: 0.007,
  // Fable 5: coaching-hoofdsynthese + uitdaging. Geen event-log voor deze twee
  // (arnobot_coaching is één rij per gebruiker, geen append-log), dus blijft
  // een aanname, ook in de trackrecord-berekening.
  coachingPerGebruikerPerMaand: 2,
  coachingKostenPerSynthese: 0.18,
  uitdagingPerGebruikerPerMaand: 10,
  uitdagingKostenPerStuk: 0.025,
  // Sparring (Sonnet 4.6), $ per bericht + $ per debrief
  kostenPerSparringBericht: 0.006,
  kostenPerDebrief: 0.015,
  // Vangnet voor kleinere Anthropic-routes (session-end, coaching-precheck,
  // blog-synthese, verfijn, sessies-zoeken), $ per gebruiker/maand
  overigeAnthropicPerGebruikerPerMaand: 0.05,
  // ElevenLabs: credits per teken (Flash v2.5). ElevenLabs zelf bevestigt alleen
  // een bereik van 0,5-1, dit is de veilige kant van dat bereik.
  creditPerTeken: 1.0,
  tekensPerVoiceAntwoord: 500,
  // Whisper-transcriptie + korte Anthropic-voice-call, $ per voice-interactie
  kostenPerVoiceInteractie: 0.004,
  tiers: [
    { name: 'Starter', credits: 30000, price: 6 },
    { name: 'Creator', credits: 121000, price: 22 },
    { name: 'Pro', credits: 600000, price: 99 },
    { name: 'Scale', credits: 1800000, price: 299 },
    { name: 'Business', credits: 6000000, price: 990 },
  ] as Tier[],
  // Vaste infrastructuurkosten, onafhankelijk van gebruiksvolume
  vercelSeats: 1,
  vercelPerSeat: 20,
  supabaseProUsd: 25,
  clerkProUsd: 100,
  clerkProActief: false,
  sentryEur: 26,
  fxRateEurUsd: 1.08,
  domeinPerJaarUsd: 52,
  upstashFreeLimit: 500000,
  upstashPerBericht: 10,
  upstashPricePer100k: 0.2,
}

export function elevenLabsCost(creditsNeeded: number, tiers: Tier[]): { price: number; name: string } {
  if (creditsNeeded <= 0) return { price: 0, name: '-' }
  for (const t of tiers) {
    if (creditsNeeded <= t.credits) return { price: t.price, name: t.name }
  }
  const business = tiers[tiers.length - 1]
  const multiples = Math.ceil(creditsNeeded / business.credits)
  return { price: business.price * multiples, name: `${business.name} x${multiples}` }
}

export function vasteKostenPerMaand(): number {
  return TARIEVEN.vercelSeats * TARIEVEN.vercelPerSeat
    + TARIEVEN.supabaseProUsd
    + (TARIEVEN.clerkProActief ? TARIEVEN.clerkProUsd : 0)
    + TARIEVEN.sentryEur * TARIEVEN.fxRateEurUsd
    + TARIEVEN.domeinPerJaarUsd / 12
}
