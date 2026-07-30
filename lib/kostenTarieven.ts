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
  // Omzettarieven per plan, EUR/maand. Command/team heeft geen vlak tarief
  // (staffel per seat, zie project-team-pricing) en telt daarom niet mee in
  // de omzetprognose, alleen het aantal gebruikers wordt getoond.
  prijsBasisEur: 37,
  prijsPremiumEur: 77,
  prijsEliteEur: 397,
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

// Volledige input-set voor computeForN: TARIEVEN (rates) + instelbare
// volume-aannames. Gedeeld tussen de Calculator (tab 1, instelbaar per
// gebruiker) en het Scenario-blok op Business case (tab 3, hypothetisch
// gebruikersaantal), zodat beide exact dezelfde rekenregels gebruiken.
export type Inputs = {
  berichten: number
  anthropicPerBericht: number
  analysesPerGebruiker: number
  kostenPerAnalyse: number
  coachingPerGebruiker: number
  coachingKostenPerSynthese: number
  uitdagingPerGebruiker: number
  uitdagingKostenPerStuk: number
  pctSparring: number
  sparringSessiesPerGebruiker: number
  berichtenPerSparringSessie: number
  kostenPerSparringBericht: number
  kostenPerDebrief: number
  overigeAnthropicPerGebruiker: number
  pctVoice: number
  voiceInteracties: number
  tekensPerAntwoord: number
  creditPerTeken: number
  kostenPerInteractie: number
  tiers: Tier[]
  vercelSeats: number
  vercelPerSeat: number
  supabasePro: boolean
  clerkPro: boolean
  sentryEur: number
  fxRate: number
  upstashFreeLimit: number
  upstashPerBericht: number
  upstashPrice: number
  domeinPerJaar: number
}

// Uitgangspunt: "redelijk actieve" gebruikers, niet het ruwe gemeten gemiddelde.
// Bewust aan de hoge kant gekozen (besloten 2026-07-29) zodat de pagina bij het
// openen nooit een te optimistisch beeld geeft, dat achteraf tegenvalt.
export const DEFAULT_INPUTS: Inputs = {
  berichten: 60,
  anthropicPerBericht: TARIEVEN.anthropicPerBericht,
  // Analyses (app/api/bot/coaching-analyse/route.ts, Sonnet 4.6, heet in de app
  // "Analyses" op /bot/analyses, niet meer "BIEB"). Aantal op 8/maand gezet
  // door Arno (2026-07-29).
  analysesPerGebruiker: 8,
  kostenPerAnalyse: TARIEVEN.kostenPerAnalyse,
  // Fable 5 ($10 in / $50 uit per 1M tokens), gebruikt in coaching-hoofdsynthese
  // (max_tokens 4000) en de uitdaging-route (max_tokens 600).
  coachingPerGebruiker: TARIEVEN.coachingPerGebruikerPerMaand,
  coachingKostenPerSynthese: TARIEVEN.coachingKostenPerSynthese,
  uitdagingPerGebruiker: TARIEVEN.uitdagingPerGebruikerPerMaand,
  uitdagingKostenPerStuk: TARIEVEN.uitdagingKostenPerStuk,
  // Sparring (app/api/sparring/*, Sonnet 4.6), gebaseerd op echt gemeten gebruik
  // uit juli 2026: 9 sessies, 2 gebruikers, gem. 17,7 berichten/sessie.
  pctSparring: 20,
  sparringSessiesPerGebruiker: 5,
  berichtenPerSparringSessie: 12,
  kostenPerSparringBericht: TARIEVEN.kostenPerSparringBericht,
  kostenPerDebrief: TARIEVEN.kostenPerDebrief,
  // Vangnet voor de rest van de modelinventaris: session-end (Haiku, 3 calls),
  // coaching-precheck, blog-synthese, verfijn, sessies-zoeken. Stuk voor stuk
  // verwaarloosbaar (Haiku of korte Sonnet-calls), hier samengevoegd i.p.v.
  // elke route apart te modelleren.
  overigeAnthropicPerGebruiker: TARIEVEN.overigeAnthropicPerGebruikerPerMaand,
  pctVoice: 30,
  voiceInteracties: 100,
  tekensPerAntwoord: TARIEVEN.tekensPerVoiceAntwoord,
  // ElevenLabs bevestigt zelf alleen een bereik van 0,5 tot 1 credit/teken voor
  // Flash/Turbo bij API-gebruik, geen exact getal. 1,0 is de veilige kant van
  // dat bevestigde bereik, niet de gunstigste kant uit derde-partij-bronnen.
  creditPerTeken: TARIEVEN.creditPerTeken,
  kostenPerInteractie: TARIEVEN.kostenPerVoiceInteractie,
  tiers: TARIEVEN.tiers,
  vercelSeats: TARIEVEN.vercelSeats,
  vercelPerSeat: TARIEVEN.vercelPerSeat,
  supabasePro: true,
  clerkPro: TARIEVEN.clerkProActief,
  sentryEur: TARIEVEN.sentryEur,
  fxRate: TARIEVEN.fxRateEurUsd,
  upstashFreeLimit: TARIEVEN.upstashFreeLimit,
  upstashPerBericht: TARIEVEN.upstashPerBericht,
  upstashPrice: TARIEVEN.upstashPricePer100k,
  domeinPerJaar: TARIEVEN.domeinPerJaarUsd,
}

export function computeForN(inputs: Inputs, n: number) {
  const totaalBerichten = n * inputs.berichten
  const anthropicKosten = totaalBerichten * inputs.anthropicPerBericht
  const analysesKosten = n * inputs.analysesPerGebruiker * inputs.kostenPerAnalyse
  const fable5Kosten = n * (
    inputs.coachingPerGebruiker * inputs.coachingKostenPerSynthese
    + inputs.uitdagingPerGebruiker * inputs.uitdagingKostenPerStuk
  )

  const sparringGebruikers = n * (inputs.pctSparring / 100)
  const totaalSparringSessies = sparringGebruikers * inputs.sparringSessiesPerGebruiker
  const totaalSparringBerichten = totaalSparringSessies * inputs.berichtenPerSparringSessie
  const sparringKosten = totaalSparringBerichten * inputs.kostenPerSparringBericht
    + totaalSparringSessies * inputs.kostenPerDebrief

  const overigeAnthropicKosten = n * inputs.overigeAnthropicPerGebruiker

  const voiceGebruikers = n * (inputs.pctVoice / 100)
  const totaalInteracties = voiceGebruikers * inputs.voiceInteracties
  const totaalTekens = totaalInteracties * inputs.tekensPerAntwoord
  const creditsNodig = totaalTekens * inputs.creditPerTeken
  const eleven = elevenLabsCost(creditsNodig, inputs.tiers)
  const whisperKosten = totaalInteracties * inputs.kostenPerInteractie

  const upstashCommands = totaalBerichten * inputs.upstashPerBericht
  const upstashOverage = Math.max(0, upstashCommands - inputs.upstashFreeLimit)
  const upstashKosten = (upstashOverage / 100000) * inputs.upstashPrice

  const sentryUsd = inputs.sentryEur * inputs.fxRate
  const domeinPerMaand = inputs.domeinPerJaar / 12
  const vastKosten = inputs.vercelSeats * inputs.vercelPerSeat
    + (inputs.supabasePro ? 25 : 0)
    + (inputs.clerkPro ? 100 : 0)
    + sentryUsd
    + domeinPerMaand

  const totaal = vastKosten + anthropicKosten + analysesKosten + fable5Kosten + sparringKosten + overigeAnthropicKosten
    + eleven.price + whisperKosten + upstashKosten

  return {
    vastKosten, anthropicKosten, analysesKosten, fable5Kosten, sparringKosten, overigeAnthropicKosten,
    elevenPrice: eleven.price, elevenName: eleven.name,
    whisperKosten, upstashKosten, totaal, perGebruiker: n > 0 ? totaal / n : 0,
  }
}

// Freemium-gebruikers kunnen alleen sparren en gesprekken voeren (geen
// analyses, geen coaching/Fable 5, geen voice), dus draagt maar een deel van
// computeForN bij: hoofdchat-berichten + sparring, verder niets. Vaste
// infrastructuurkosten worden niet nogmaals meegeteld, die zitten al één keer
// in computeForN voor de betalende gebruikers.
export function computeFreemiumKostenPerGebruiker(inputs: Inputs): number {
  const anthropicKosten = inputs.berichten * inputs.anthropicPerBericht
  const sparringAandeel = inputs.pctSparring / 100
  const sparringKosten = sparringAandeel * (
    inputs.sparringSessiesPerGebruiker * inputs.berichtenPerSparringSessie * inputs.kostenPerSparringBericht
    + inputs.sparringSessiesPerGebruiker * inputs.kostenPerDebrief
  )
  return anthropicKosten + sparringKosten
}

// Betaalprovider (Emirates NBD Pay / Network International): geen publiek
// tarief, marktbenchmark voor internationaal uitgegeven kaarten. Gedeeld
// tussen Calculator (tab 1, telt mee in de totale kosten) en het
// Scenario-blok op Business case (tab 3), zodat beide exact dezelfde omzet-
// en fee-berekening gebruiken voor eenzelfde hypothetisch aantal gebruikers.
export type Prijzen = { basis: number; premium: number; elite: number }
export type TierVerdeling = { basis: number; premium: number; elite: number }
export type Betaalprovider = { mdrPct: number; mdrFixed: number; pctCreditcard: number }

export const DEFAULT_PRIJZEN: Prijzen = { basis: TARIEVEN.prijsBasisEur, premium: TARIEVEN.prijsPremiumEur, elite: TARIEVEN.prijsEliteEur }
export const DEFAULT_TIER_VERDELING: TierVerdeling = { basis: 58, premium: 40, elite: 2 }
export const DEFAULT_BETAALPROVIDER: Betaalprovider = { mdrPct: 3.5, mdrFixed: 0.25, pctCreditcard: 100 }

export function berekenOmzetEnBetaalprovider(prijzen: Prijzen, verdeling: TierVerdeling, betaalprovider: Betaalprovider, n: number) {
  // Bij optellen tot 100% of minder verandert er niets (rest = niet
  // meegeteld, bv. freemium of onbekend). Bij meer dan 100% (tikfout, of een
  // aanroeper die zelf ook nog een ander segment zoals freemium meetelt)
  // schalen we proportioneel terug, zodat basisN+premiumN+eliteN nooit meer
  // dan n kan zijn.
  const noemer = Math.max(verdeling.basis + verdeling.premium + verdeling.elite, 100)
  const basisN = Math.round(n * (verdeling.basis / noemer))
  const premiumN = Math.round(n * (verdeling.premium / noemer))
  const eliteN = Math.round(n * (verdeling.elite / noemer))
  const omzet = basisN * prijzen.basis + premiumN * prijzen.premium + eliteN * prijzen.elite
  const aandeel = betaalprovider.pctCreditcard / 100
  const betaalproviderKosten = omzet * aandeel * (betaalprovider.mdrPct / 100)
    + (basisN + premiumN + eliteN) * aandeel * betaalprovider.mdrFixed
  return { basisN, premiumN, eliteN, omzet, betaalproviderKosten }
}
