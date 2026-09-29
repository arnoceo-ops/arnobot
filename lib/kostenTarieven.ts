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
  // Fable 5.1: coaching-hoofdsynthese + uitdaging. Geen event-log voor deze
  // twee (arnobot_coaching is één rij per gebruiker, geen append-log), dus
  // blijft een aanname, ook in de trackrecord-berekening. Prijs ongewijzigd
  // t.o.v. Fable 5 ($10 in / $50 uit per 1M tokens), geverifieerd 2026-09-29.
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
  // AssemblyAI: audiobijlage-transcriptie + sprekersherkenning in de hoofdchat
  // (lib/assemblyai.ts, Pro/Team-only, "hidden" feature sinds 2026-09-17, geen
  // eigen pagina/aankondiging). universal-3-5-pro $0,21/uur + standaard
  // diarization $0,02/uur = $0,23/uur, omgerekend naar $/minuut. Nog geen
  // gemeten gebruik (feature net gebouwd), dus de twee volume-aannames
  // hieronder (DEFAULT_INPUTS) zijn een voorzichtige placeholder, geen
  // gemeten data zoals bij de andere routes.
  assemblyaiPerMinuut: 0.23 / 60,
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
  // Bevestigd door Arno: op 2026-08-10 geüpgraded naar Supabase Pro. Zelfde
  // patroon als clerkProActief hieronder (besloten 2026-08-11, gevonden bij
  // audit: vasteKostenPerMaand() telde supabaseProUsd voorheen altijd mee,
  // zonder toggle, terwijl computeScenarioKosten dat wél voorwaardelijk deed
  // via inputs.supabasePro).
  supabaseProActief: true,
  // PITR (Point-in-Time Recovery), $ per maand bij 7 dagen bewaartermijn
  // (geverifieerd tegen supabase.com/docs, 2026-08-11). Los van
  // supabaseProUsd: dat is het basisplan (voorkomt auto-verwijdering van
  // inactieve projecten), dit is een add-on erbovenop. Pro geeft al gratis
  // dagelijkse backups (7 dagen bewaartermijn) zonder PITR, dus dit voegt
  // alleen precisie toe (herstel tot op de minuut i.p.v. laatste nachtelijke
  // snapshot). Geen handmatige toggle (besloten 2026-08-11, op Arno's
  // verzoek): telt automatisch mee zodra het gebruikersaantal de drempel
  // haalt, zodat dit niet vergeten kan worden aan te zetten. Bewust een
  // hogere drempel (150) dan de andere Pro-upgrades in CLAUDE.md (50):
  // Arno's eigen keuze, losse drempel, geen gekoppelde mijlpaal. Verhoogd van
  // 100 naar 150 op 2026-09-29.
  supabasePitrUsd: 100,
  supabasePitrDrempel: 150,
  clerkProUsd: 25,
  clerkProActief: false,
  // Moneybird (boekhouding, gekoppeld aan Mollie): Growth-tier, de eerste tier
  // met terugkerende facturen/abonnementen (nodig voor Team-facturatie),
  // besloten 2026-09-29 bij de Mollie/Moneybird-keuze. €35/maand is het
  // maandelijkse-betaling-tarief (bevestigd op moneybird.nl/prijzen,
  // geverifieerd 2026-09-29); €29 was het jaarlijkse-betaling-tarief, niet van
  // toepassing want Arno betaalt maandelijks. Altijd meegeteld, geen toggle
  // (besloten 2026-09-29, was eerst `moneybirdActief` net als Clerk Pro, maar
  // dit account staat altijd aan zodra het bestaat, geen optioneel scenario
  // zoals Clerk Pro's inactivity-timeout-afweging). EUR-native, geen fx nodig
  // in vasteKostenPerMaand/computeScenarioKosten behalve de omrekening naar de
  // dollar-context daar (zelfde patroon als sentryEur).
  moneybirdEur: 35,
  // Bevestigd door Arno (2026-09-17): nog op Sentry's gratis tier, geen
  // betaald plan. Het eerdere bedrag (26) was een currency-mismatch, Sentry's
  // eigen prijzen zijn in USD ($26/mo jaarlijks, $29/mo maandelijks), niet
  // EUR, en waren sowieso niet van toepassing zolang er geen betaald plan is.
  // Bijwerken naar het echte bedrag zodra Sentry's gratis tier niet meer volstaat.
  sentryEur: 0,
  // PostHog staat bewust NIET in deze berekening: gratis tier (1M events, 5k session
  // recordings, 1M flag-requests per maand), verbruik stopt bij de limiet zonder
  // betaalmethode, dus geen verrassingskosten. Opnemen zodra een van die limieten
  // structureel wordt overschreden of er een betaald plan wordt genomen. Bij de
  // kwartaalcheck controleren tegen het werkelijke PostHog-verbruik.
  // Bijgewerkt 2026-09-29 (doorrekenronde na de Mollie/Moneybird-migratie):
  // was 1.1542, live mid-market koers op dat moment (xe.com) was 1,1350. Was
  // ~1,7% te hoog, wat elke USD-kostenpost (Vercel, Supabase, Clerk, Porkbun)
  // structureel iets te hoog omrekende naar EUR. Vorige update 2026-09-17: was
  // toen 1.08, ~7% te laag.
  fxRateEurUsd: 1.135,
  domeinPerJaarUsd: 52,
  upstashFreeLimit: 500000,
  upstashPerBericht: 10,
  upstashPricePer100k: 0.2,
  // Teamspecifieke meerkost per teamlid/maand (1:1-voorbereiding via
  // app/api/bot/team/1on1/route.ts, Haiku, en teamoverzicht-aggregatie),
  // bovenop de gewone Pro-kosten die een teamlid toch al genereert. Ruime
  // schatting, geen event-log om tegen te meten (besloten 2026-08-01).
  teamOverheadPerLidPerMaandUsd: 0.03,
  // Omzettarieven per plan, EUR/maand. Command/team heeft geen vlak tarief
  // (staffel per seat, zie project-team-pricing) en telt daarom niet mee in
  // de omzetprognose, alleen het aantal gebruikers wordt getoond.
  // prijsBasisEur/prijsPremiumEur vastgezet op 29/59 (besloten/bevestigd
  // 2026-08-01, vervangt het eerdere 38/77 van 2026-07-31), gelijk aan
  // SCENARIO_PRIJZEN.basicMaandelijks/proMaandelijks hieronder.
  prijsBasisEur: 29,
  prijsPremiumEur: 59,
}

// Boven de Business-tier: volle Business-tiers kopen voor het grootste deel,
// en voor het restant de goedkoopste tier die dat nog dekt (kan een kleinere
// tier zijn dan Business, dus niet altijd nog een hele Business erbij).
// Besloten 2026-08-11 (gevonden bij audit): de oude versie kocht altijd hele
// Business-tiers ook voor een klein restant (bv. €1980 i.p.v. €996 net boven
// de grens), een structurele overschatting bij schaal. Geen volledige
// combinatie-optimalisatie (tiers liggen dicht bij elkaar qua prijs/credit,
// marginale winst daarvan is verwaarloosbaar voor een interne schattingstool).
export function elevenLabsCost(creditsNeeded: number, tiers: Tier[]): { price: number; name: string } {
  if (creditsNeeded <= 0) return { price: 0, name: '-' }
  for (const t of tiers) {
    if (creditsNeeded <= t.credits) return { price: t.price, name: t.name }
  }
  const business = tiers[tiers.length - 1]
  const wholeBusinessTiers = Math.floor(creditsNeeded / business.credits)
  const rest = creditsNeeded - wholeBusinessTiers * business.credits
  if (rest === 0) return { price: business.price * wholeBusinessTiers, name: `${business.name} x${wholeBusinessTiers}` }
  const restTier = tiers.find(t => rest <= t.credits) ?? business
  return {
    price: business.price * wholeBusinessTiers + restTier.price,
    name: `${business.name} x${wholeBusinessTiers} + ${restTier.name}`,
  }
}

// gebruikersAantal: echt gemeten actieve gebruikers deze maand (Trackrecord).
// PITR telt automatisch mee zodra dat de mijlpaal-drempel haalt. fxRate:
// optioneel overschrijfbaar met een live-opgehaalde koers (lib/fxRate.ts),
// valt terug op de hardcoded TARIEVEN.fxRateEurUsd als niemand er een
// meegeeft (besloten 2026-09-29, bij de invoering van de live FX-koers).
export function vasteKostenPerMaand(gebruikersAantal: number, fxRate: number = TARIEVEN.fxRateEurUsd): number {
  return TARIEVEN.vercelSeats * TARIEVEN.vercelPerSeat
    + (TARIEVEN.supabaseProActief ? TARIEVEN.supabaseProUsd : 0)
    + (gebruikersAantal >= TARIEVEN.supabasePitrDrempel ? TARIEVEN.supabasePitrUsd : 0)
    + (TARIEVEN.clerkProActief ? TARIEVEN.clerkProUsd : 0)
    + TARIEVEN.moneybirdEur * fxRate
    + TARIEVEN.sentryEur * fxRate
    + TARIEVEN.domeinPerJaarUsd / 12
}

// Volledige input-set voor computeScenarioKosten: TARIEVEN (rates) +
// instelbare volume-aannames. State leeft in KostenPageClient.tsx en wordt
// gedeeld tussen de Calculator (tab 1, instelbaar per gebruiker) en het
// Scenario-blok op Business case (tab 3, hypothetisch gebruikersaantal),
// zodat beide daadwerkelijk exact dezelfde rekenregels gebruiken (besloten
// 2026-08-11: stond hiervoor alleen lokaal in tab 1, tab 3 gebruikte altijd
// DEFAULT_INPUTS ongeacht wat op tab 1 was aangepast, zie audit-bevindingen).
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
  pctAudioAnalyse: number
  audioMinutenPerGebruiker: number
  assemblyaiPerMinuut: number
  tiers: Tier[]
  vercelSeats: number
  vercelPerSeat: number
  supabasePro: boolean
  clerkPro: boolean
  moneybirdEur: number
  sentryEur: number
  fxRate: number
  upstashFreeLimit: number
  upstashPerBericht: number
  upstashPrice: number
  domeinPerJaar: number
  teamOverheadPerLid: number
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
  // AssemblyAI-audioanalyse: net gebouwd (2026-09-17), "hidden" feature zonder
  // eigen aankondiging, dus geen gemeten volume om op te baseren. Voorzichtige
  // placeholder-aannames, bewust laag: 5% van de Pro/Team-gebruikers gebruikt
  // 'm ooit in een maand, gemiddeld 20 minuten audio per keer (~één kort
  // gespreksfragment). Bijwerken zodra er echt gebruik is.
  pctAudioAnalyse: 5,
  audioMinutenPerGebruiker: 20,
  assemblyaiPerMinuut: TARIEVEN.assemblyaiPerMinuut,
  tiers: TARIEVEN.tiers,
  vercelSeats: TARIEVEN.vercelSeats,
  vercelPerSeat: TARIEVEN.vercelPerSeat,
  // Bevestigd 2026-08-10 daadwerkelijk geüpgraded. Sinds 2026-08-11 (audit)
  // niet meer los hardgecodeerd, maar dezelfde bron als vasteKostenPerMaand().
  supabasePro: TARIEVEN.supabaseProActief,
  clerkPro: TARIEVEN.clerkProActief,
  moneybirdEur: TARIEVEN.moneybirdEur,
  sentryEur: TARIEVEN.sentryEur,
  fxRate: TARIEVEN.fxRateEurUsd,
  upstashFreeLimit: TARIEVEN.upstashFreeLimit,
  upstashPerBericht: TARIEVEN.upstashPerBericht,
  upstashPrice: TARIEVEN.upstashPricePer100k,
  domeinPerJaar: TARIEVEN.domeinPerJaarUsd,
  teamOverheadPerLid: TARIEVEN.teamOverheadPerLidPerMaandUsd,
}

// Basic en Pro in het Scenario-blok (tab 3): geen aparte kostenformule zoals
// eerder bij freemium, want Basic heeft hetzelfde hoofdchatvolume als Pro
// (besloten 2026-07-31: chat is de kernfunctionaliteit, geen reden om lager
// gebruik aan te nemen). Wel harde, in de code afgedwongen verschillen:
// - Coaching/Fable 5: geen toegang voor Basic (`plan==='basis'` geblokkeerd
//   in app/api/bot/coaching/route.ts en coaching-precheck/route.ts).
// - Voice: geen toegang voor Basic (lib/voice.ts, hasVoiceAccess).
// - Analyses: wel toegang, maar hard gelimiteerd tot 1x/dag
//   (coaching-analyse/route.ts), dus een veel lagere maandaanname dan Pro's
//   instelbare aantal.
// - Sparren: geen tier-check gevonden in de routes, dus gelijk voor beide.
// Vaste kosten tellen maar één keer mee, de voice/coaching/analyses-termen
// gebruiken per tier een andere N (proEffectief vs. basicN, zie hieronder).
const BASIC_ANALYSES_PER_MAAND = 4

// teamLeden (besloten 2026-08-01): Team-leden krijgen "Alles van Pro, plus:",
// dus tellen voor analyses/coaching/voice/overige-Anthropic mee als extra
// Pro-gebruikers (proEffectief), en voor hoofdchat/sparring/Upstash als extra
// gebruikers in n. teamOverheadKosten is de kleine, aparte meerkost van de
// teamspecifieke routes (1:1-voorbereiding, teamoverzicht), die een gewone
// Pro-gebruiker niet heeft. Telt hierdoor niet dubbel: het is een aanvulling
// bovenop, geen vervanging van, de Pro-kostenregels hierboven.
export function computeScenarioKosten(inputs: Inputs, basicN: number, proN: number, teamLeden: number = 0) {
  const proEffectief = proN + teamLeden
  const n = basicN + proEffectief
  const totaalBerichten = n * inputs.berichten
  const anthropicKosten = totaalBerichten * inputs.anthropicPerBericht

  const analysesKosten = (proEffectief * inputs.analysesPerGebruiker + basicN * BASIC_ANALYSES_PER_MAAND) * inputs.kostenPerAnalyse

  const fable5Kosten = proEffectief * (
    inputs.coachingPerGebruiker * inputs.coachingKostenPerSynthese
    + inputs.uitdagingPerGebruiker * inputs.uitdagingKostenPerStuk
  )

  const sparringGebruikers = n * (inputs.pctSparring / 100)
  const totaalSparringSessies = sparringGebruikers * inputs.sparringSessiesPerGebruiker
  const totaalSparringBerichten = totaalSparringSessies * inputs.berichtenPerSparringSessie
  const sparringKosten = totaalSparringBerichten * inputs.kostenPerSparringBericht
    + totaalSparringSessies * inputs.kostenPerDebrief

  // Bundelt coaching-gerelateerde (precheck, blog-synthese) en niet-
  // gerelateerde (session-end, verfijn, sessies-zoeken) routes, verwaarloosbaar
  // bedrag, hier niet verder uitgesplitst, toegepast op Pro (grootste overlap
  // met coaching-routes).
  const overigeAnthropicKosten = proEffectief * inputs.overigeAnthropicPerGebruiker

  const voiceGebruikers = proEffectief * (inputs.pctVoice / 100)
  const totaalInteracties = voiceGebruikers * inputs.voiceInteracties
  const totaalTekens = totaalInteracties * inputs.tekensPerAntwoord
  const creditsNodig = totaalTekens * inputs.creditPerTeken
  const eleven = elevenLabsCost(creditsNodig, inputs.tiers)
  const whisperKosten = totaalInteracties * inputs.kostenPerInteractie

  // Audiobijlage-analyse (AssemblyAI): net als Voice alleen voor Pro/Team
  // (proEffectief), Basic heeft hier geen toegang toe (app/api/chat/route.ts,
  // 'audio_alleen_betaald').
  const audioAnalyseGebruikers = proEffectief * (inputs.pctAudioAnalyse / 100)
  const audioAnalyseKosten = audioAnalyseGebruikers * inputs.audioMinutenPerGebruiker * inputs.assemblyaiPerMinuut

  const upstashCommands = totaalBerichten * inputs.upstashPerBericht
  const upstashOverage = Math.max(0, upstashCommands - inputs.upstashFreeLimit)
  const upstashKosten = (upstashOverage / 100000) * inputs.upstashPrice

  const teamOverheadKosten = teamLeden * inputs.teamOverheadPerLid

  const sentryUsd = inputs.sentryEur * inputs.fxRate
  const domeinPerMaand = inputs.domeinPerJaar / 12
  const moneybirdUsd = inputs.moneybirdEur * inputs.fxRate
  const vastKosten = inputs.vercelSeats * inputs.vercelPerSeat
    + (inputs.supabasePro ? TARIEVEN.supabaseProUsd : 0)
    + (n >= TARIEVEN.supabasePitrDrempel ? TARIEVEN.supabasePitrUsd : 0)
    + (inputs.clerkPro ? TARIEVEN.clerkProUsd : 0)
    + moneybirdUsd
    + sentryUsd
    + domeinPerMaand

  const totaal = vastKosten + anthropicKosten + analysesKosten + fable5Kosten + sparringKosten + overigeAnthropicKosten
    + eleven.price + whisperKosten + audioAnalyseKosten + upstashKosten + teamOverheadKosten

  return {
    vastKosten, anthropicKosten, analysesKosten, fable5Kosten, sparringKosten, overigeAnthropicKosten,
    elevenPrice: eleven.price, elevenName: eleven.name,
    whisperKosten, audioAnalyseKosten, upstashKosten, teamOverheadKosten, totaal, perGebruiker: n > 0 ? totaal / n : 0,
  }
}

// Betaalprovider: Mollie (besloten 2026-09-29, vervangt de eerdere generieke
// Emirates NBD Pay/Network International-marktbenchmark placeholder). Gedeeld
// tussen Calculator (tab 1, telt mee in de totale kosten) en het
// Scenario-blok op Business case (tab 3), zodat beide exact dezelfde omzet-
// en fee-berekening gebruiken voor eenzelfde hypothetisch aantal gebruikers.
//
// Mollie-tarieven (mollie.com/pricing, geverifieerd 2026-09-29): kaart
// (EU-consument) 1,8% + €0,25; SEPA-incasso (recurring) €0,35 vlak, geen %
// (was eerst 0,4%+€0,25 aangenomen o.b.v. derde-partij-bronnen, Mollie's eigen
// pricing-pagina bevestigt een vlak tarief zonder percentage-component,
// gecorrigeerd bij de doorrekenronde van 2026-09-29); SEPA-overschrijving
// (Team-facturen via Moneybird-betaallink) €0,25 vlak, geen %.
// Realistisch NL-verkeerspatroon voor terugkerende Basic/Pro-abonnementen:
// eerste betaling via iDEAL (mandaat), vervolgtermijnen via SEPA-incasso, dus
// de meerderheid van het volume loopt NIET via kaart. pctCreditcard is bewust
// laag gezet (25%) t.o.v. de oude 100%-kaart-aanname, met sepaPct/sepaFixed
// voor het resterende aandeel: de oude formule rekende dat deel op €0, wat
// met een echte SEPA-incasso-fee niet meer klopt (gevonden bij de
// Mollie-doorrekening, zie geheugen project_payment_provider). Aanname, geen
// gemeten data, bijwerken zodra er echte transacties zijn.
//
// Prijzen (basis/premium) is losstaand: dat blijft de échte, huidige
// live prijs zoals die nu op arno.bot staat, gebruikt door Trackrecord bij
// het afsluiten van een maand met écht gemeten Basis/Premium-klanten
// uit approved_users. Wordt hier bewust niet aangeraakt.
//
// ScenarioPrijzen/TierVerdeling/ScenarioBillingSplit zijn het losse,
// hypothetische model voor het Scenario-blok en de Doelwinst-solver: geen
// freemium meer (besloten, definitief geschrapt), twee tiers, Basic en Pro
// (interne Abacus-namen, nog niet per se de namen op arno.bot/prijzen).
export type Prijzen = { basis: number; premium: number }
// basicJaarlijksTotaal/proJaarlijksTotaal zijn de jaarprijs zelf (het bedrag
// dat je één keer per jaar betaalt), niet een per-maand-equivalent: die
// omrekening (/12) gebeurt in gemiddeldePrijsPerMaand hieronder.
export type ScenarioPrijzen = { basicMaandelijks: number; basicJaarlijksTotaal: number; proMaandelijks: number; proJaarlijksTotaal: number }
export type ScenarioBillingSplit = { basicPctJaarlijks: number; proPctJaarlijks: number }
export type TierVerdeling = { basic: number; pro: number }
export type Betaalprovider = {
  mdrPct: number; mdrFixed: number; pctCreditcard: number
  sepaPct: number; sepaFixed: number
  teamFixed: number
}
// Team staat los van TierVerdeling: geen % van "Totaal aantal gebruikers",
// want een teamklant is geen individu maar een manager-account met eigen
// teamleden eronder (besloten 2026-08-01, optie B uit het gesprek over hoe
// Team in Abacus te modelleren). aantalKlanten = aantal teamaccounts,
// gemiddeldeLeden = totaal aantal betalende gebruikers per account,
// inclusief de manager zelf (die ook chat/coacht en dus kosten genereert).
export type TeamScenario = { aantalKlanten: number; gemiddeldeLeden: number }
// %-verdeling maandelijks/jaarlijks voor Team, zelfde patroon als
// ScenarioBillingSplit voor Basic/Pro (besloten 2026-08-10, bij de invoering
// van de Team-jaaroptie).
export type TeamBillingSplit = { pctJaarlijks: number }

export const DEFAULT_PRIJZEN: Prijzen = { basis: TARIEVEN.prijsBasisEur, premium: TARIEVEN.prijsPremiumEur }
// Definitieve, vaste Abacus-tarieven (besloten en bevestigd 2026-08-01,
// vervangt het eerdere 38/347/77/707 van 2026-07-31): niet meer instelbaar
// in de UI, de enige keuzeopties zijn de %-verdeling (TierVerdeling) en de
// %-betaalcyclus per tier (ScenarioBillingSplit). TARIEVEN.prijsBasisEur/
// prijsPremiumEur hierboven zijn in dezelfde beslissing meegewijzigd naar
// 29/59. Sinds 2026-08-10 importeert app/prijzen/PrijzenClient.tsx deze
// constanten direct, dezelfde bron, geen losse hardgecodeerde bedragen meer.
export const SCENARIO_PRIJZEN: ScenarioPrijzen = { basicMaandelijks: 29, basicJaarlijksTotaal: 228, proMaandelijks: 59, proJaarlijksTotaal: 468 }
export const DEFAULT_BILLING_SPLIT: ScenarioBillingSplit = { basicPctJaarlijks: 40, proPctJaarlijks: 10 }
export const DEFAULT_TIER_VERDELING: TierVerdeling = { basic: 80, pro: 20 }
export const DEFAULT_BETAALPROVIDER: Betaalprovider = {
  mdrPct: 1.8, mdrFixed: 0.25, pctCreditcard: 25,
  sepaPct: 0, sepaFixed: 0.35,
  teamFixed: 0.25,
}
// Team-tarief (besloten 2026-08-01, jaaroptie toegevoegd 2026-08-10): €97
// basis + €49/gebruiker/maand bij maandelijkse betaling, €77 + €39/gebruiker
// als maand-equivalent bij jaarlijkse vooruitbetaling (~20% korting, bewust
// minder dan Basic/Pro's ~34%, zie lib/teamPricing.ts voor de volledige
// onderbouwing). Zelfde structuur als ScenarioPrijzen hierboven.
export type ScenarioTeamPrijzen = {
  basisMaandelijks: number; basisJaarlijksTotaal: number
  perGebruikerMaandelijks: number; perGebruikerJaarlijksTotaal: number
}
export const SCENARIO_TEAM_PRIJS: ScenarioTeamPrijzen = {
  basisMaandelijks: 97, basisJaarlijksTotaal: 924,
  perGebruikerMaandelijks: 49, perGebruikerJaarlijksTotaal: 468,
}
export const DEFAULT_TEAM_SCENARIO: TeamScenario = { aantalKlanten: 5, gemiddeldeLeden: 5 }
// Startaanname, instelbaar op de Business case-tab: nog geen gemeten data
// over hoeveel Team-klanten voor jaarlijks kiezen (de optie is nieuw).
export const DEFAULT_TEAM_BILLING_SPLIT: TeamBillingSplit = { pctJaarlijks: 20 }

function gemiddeldePrijsPerMaand(maandelijks: number, jaarlijksTotaal: number, pctJaarlijks: number): number {
  const aandeelJaarlijks = pctJaarlijks / 100
  return aandeelJaarlijks * (jaarlijksTotaal / 12) + (1 - aandeelJaarlijks) * maandelijks
}

export function berekenScenarioOmzetEnBetaalprovider(
  scenarioPrijzen: ScenarioPrijzen, billingSplit: ScenarioBillingSplit,
  verdeling: TierVerdeling, betaalprovider: Betaalprovider, n: number,
  teamPrijs: ScenarioTeamPrijzen = SCENARIO_TEAM_PRIJS,
  team: TeamScenario = DEFAULT_TEAM_SCENARIO,
  teamBillingSplit: TeamBillingSplit = DEFAULT_TEAM_BILLING_SPLIT
) {
  // Bij optellen tot 100% of minder verandert er niets (rest = niet
  // meegeteld). Bij meer dan 100% (tikfout) schalen we proportioneel terug,
  // zodat basicN+proN nooit meer dan n kan zijn.
  const totaalPct = verdeling.basic + verdeling.pro
  const noemer = Math.max(totaalPct, 100)
  const basicN = Math.round(n * (verdeling.basic / noemer))
  // Bij >=100% (dus geen bewust niet-meegeteld restdeel): proN = n - basicN
  // i.p.v. los afgerond, zodat basicN+proN altijd exact n is (voorkomt een
  // ±1-afwijking bij .5-grensgevallen, besloten 2026-08-11, gevonden bij
  // audit). Bij <100% blijft losse afronding correct, daar is het restdeel
  // juist bewust niet meegeteld.
  const proN = totaalPct >= 100 ? n - basicN : Math.round(n * (verdeling.pro / noemer))
  const basicPrijsGemiddeld = gemiddeldePrijsPerMaand(scenarioPrijzen.basicMaandelijks, scenarioPrijzen.basicJaarlijksTotaal, billingSplit.basicPctJaarlijks)
  const proPrijsGemiddeld = gemiddeldePrijsPerMaand(scenarioPrijzen.proMaandelijks, scenarioPrijzen.proJaarlijksTotaal, billingSplit.proPctJaarlijks)
  const omzet = basicN * basicPrijsGemiddeld + proN * proPrijsGemiddeld
  // Team is los van n: aantal teamaccounts × (basistarief + leden × tarief
  // per gebruiker), beide componenten geblend over maandelijks/jaarlijks met
  // dezelfde gemiddeldePrijsPerMaand-logica als Basic/Pro. Team-facturen lopen
  // via Moneybird, met een Mollie-betaallink erop (besloten 2026-09-29, was
  // tot dan "via factuur, niet via de betaalprovider"): telt daarom nu wél
  // mee in betaalproviderKosten, tegen het lage vlakke SEPA-overschrijving-
  // tarief (teamFixed), niet tegen kaart-/SEPA-incassotarief. Eén Mollie-
  // transactie per teamaccount per factuurmoment (basistarief + alle seats in
  // één gecombineerde factuur), dus geteld over team.aantalKlanten, niet over
  // teamLeden.
  const teamLeden = team.aantalKlanten * team.gemiddeldeLeden
  const teamBasisGemiddeld = gemiddeldePrijsPerMaand(teamPrijs.basisMaandelijks, teamPrijs.basisJaarlijksTotaal, teamBillingSplit.pctJaarlijks)
  const teamPerGebruikerGemiddeld = gemiddeldePrijsPerMaand(teamPrijs.perGebruikerMaandelijks, teamPrijs.perGebruikerJaarlijksTotaal, teamBillingSplit.pctJaarlijks)
  const teamOmzet = team.aantalKlanten * (teamBasisGemiddeld + team.gemiddeldeLeden * teamPerGebruikerGemiddeld)
  const omzetTotaal = omzet + teamOmzet
  // Kaart-aandeel (Solo) tegen mdrPct/mdrFixed, resterend Solo-aandeel tegen
  // SEPA-incasso (sepaPct/sepaFixed, niet langer €0 zoals de oude
  // kaart-only-formule aannam), Team apart tegen het vlakke SEPA-
  // overschrijvingstarief.
  const aandeel = betaalprovider.pctCreditcard / 100
  const kaartKosten = omzet * aandeel * (betaalprovider.mdrPct / 100)
    + (basicN + proN) * aandeel * betaalprovider.mdrFixed
  const sepaKosten = omzet * (1 - aandeel) * (betaalprovider.sepaPct / 100)
    + (basicN + proN) * (1 - aandeel) * betaalprovider.sepaFixed
  const teamBetaalKosten = team.aantalKlanten * betaalprovider.teamFixed
  const betaalproviderKosten = kaartKosten + sepaKosten + teamBetaalKosten
  return { basicN, proN, omzet, teamLeden, teamOmzet, omzetTotaal, betaalproviderKosten, basicPrijsGemiddeld, proPrijsGemiddeld, teamBasisGemiddeld, teamPerGebruikerGemiddeld }
}
