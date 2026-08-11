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
  prijsEliteEur: 397,
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
  tiers: TARIEVEN.tiers,
  vercelSeats: TARIEVEN.vercelSeats,
  vercelPerSeat: TARIEVEN.vercelPerSeat,
  // Arno gaat binnenkort echt upgraden naar Supabase Pro (2026-07-31), dus
  // weer op true. Was kort op false gezet (nog op Free-plan op het moment
  // van checken), zie CLAUDE.md voor de context van die check.
  supabasePro: true,
  clerkPro: TARIEVEN.clerkProActief,
  sentryEur: TARIEVEN.sentryEur,
  fxRate: TARIEVEN.fxRateEurUsd,
  upstashFreeLimit: TARIEVEN.upstashFreeLimit,
  upstashPerBericht: TARIEVEN.upstashPerBericht,
  upstashPrice: TARIEVEN.upstashPricePer100k,
  domeinPerJaar: TARIEVEN.domeinPerJaarUsd,
  teamOverheadPerLid: TARIEVEN.teamOverheadPerLidPerMaandUsd,
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
// Bewust een losse functie i.p.v. hergebruik van computeForN met n=totaal:
// vaste kosten mogen maar één keer meetellen, en de voice/coaching/analyses-
// termen moeten per tier een andere N gebruiken, dat past niet in de bestaande
// computeForN-signatuur zonder tab 1 (die geen tier-onderscheid kent) te
// compliceren. Zelfde rekenregels als computeForN, hou bij een tariefwijziging
// beide functies synchroon.
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

  const upstashCommands = totaalBerichten * inputs.upstashPerBericht
  const upstashOverage = Math.max(0, upstashCommands - inputs.upstashFreeLimit)
  const upstashKosten = (upstashOverage / 100000) * inputs.upstashPrice

  const teamOverheadKosten = teamLeden * inputs.teamOverheadPerLid

  const sentryUsd = inputs.sentryEur * inputs.fxRate
  const domeinPerMaand = inputs.domeinPerJaar / 12
  const vastKosten = inputs.vercelSeats * inputs.vercelPerSeat
    + (inputs.supabasePro ? 25 : 0)
    + (inputs.clerkPro ? 100 : 0)
    + sentryUsd
    + domeinPerMaand

  const totaal = vastKosten + anthropicKosten + analysesKosten + fable5Kosten + sparringKosten + overigeAnthropicKosten
    + eleven.price + whisperKosten + upstashKosten + teamOverheadKosten

  return {
    vastKosten, anthropicKosten, analysesKosten, fable5Kosten, sparringKosten, overigeAnthropicKosten,
    elevenPrice: eleven.price, elevenName: eleven.name,
    whisperKosten, upstashKosten, teamOverheadKosten, totaal, perGebruiker: n > 0 ? totaal / n : 0,
  }
}

// Betaalprovider (Emirates NBD Pay / Network International): geen publiek
// tarief, marktbenchmark voor internationaal uitgegeven kaarten. Gedeeld
// tussen Calculator (tab 1, telt mee in de totale kosten) en het
// Scenario-blok op Business case (tab 3), zodat beide exact dezelfde omzet-
// en fee-berekening gebruiken voor eenzelfde hypothetisch aantal gebruikers.
//
// Prijzen (basis/premium/elite) is losstaand: dat blijft de échte, huidige
// live prijs zoals die nu op arno.bot staat, gebruikt door Trackrecord bij
// het afsluiten van een maand met écht gemeten Basis/Premium/Elite-klanten
// uit approved_users. Wordt hier bewust niet aangeraakt.
//
// ScenarioPrijzen/TierVerdeling/ScenarioBillingSplit zijn het losse,
// hypothetische model voor het Scenario-blok en de Doelwinst-solver: geen
// freemium meer (besloten, definitief geschrapt), twee tiers, Basic en Pro
// (interne Abacus-namen, nog niet per se de namen op arno.bot/prijzen).
export type Prijzen = { basis: number; premium: number; elite: number }
// basicJaarlijksTotaal/proJaarlijksTotaal zijn de jaarprijs zelf (het bedrag
// dat je één keer per jaar betaalt), niet een per-maand-equivalent: die
// omrekening (/12) gebeurt in gemiddeldePrijsPerMaand hieronder.
export type ScenarioPrijzen = { basicMaandelijks: number; basicJaarlijksTotaal: number; proMaandelijks: number; proJaarlijksTotaal: number }
export type ScenarioBillingSplit = { basicPctJaarlijks: number; proPctJaarlijks: number }
export type TierVerdeling = { basic: number; pro: number }
export type Betaalprovider = { mdrPct: number; mdrFixed: number; pctCreditcard: number }
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

export const DEFAULT_PRIJZEN: Prijzen = { basis: TARIEVEN.prijsBasisEur, premium: TARIEVEN.prijsPremiumEur, elite: TARIEVEN.prijsEliteEur }
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
export const DEFAULT_BETAALPROVIDER: Betaalprovider = { mdrPct: 3.5, mdrFixed: 0.25, pctCreditcard: 100 }
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
  // dezelfde gemiddeldePrijsPerMaand-logica als Basic/Pro. Team-betalingen
  // lopen via factuur, niet via de betaalprovider (besloten 2026-08-01), dus
  // teamOmzet telt wel mee in omzetTotaal maar niet in betaalproviderKosten.
  const teamLeden = team.aantalKlanten * team.gemiddeldeLeden
  const teamBasisGemiddeld = gemiddeldePrijsPerMaand(teamPrijs.basisMaandelijks, teamPrijs.basisJaarlijksTotaal, teamBillingSplit.pctJaarlijks)
  const teamPerGebruikerGemiddeld = gemiddeldePrijsPerMaand(teamPrijs.perGebruikerMaandelijks, teamPrijs.perGebruikerJaarlijksTotaal, teamBillingSplit.pctJaarlijks)
  const teamOmzet = team.aantalKlanten * (teamBasisGemiddeld + team.gemiddeldeLeden * teamPerGebruikerGemiddeld)
  const omzetTotaal = omzet + teamOmzet
  const aandeel = betaalprovider.pctCreditcard / 100
  const betaalproviderKosten = omzet * aandeel * (betaalprovider.mdrPct / 100)
    + (basicN + proN) * aandeel * betaalprovider.mdrFixed
  return { basicN, proN, omzet, teamLeden, teamOmzet, omzetTotaal, betaalproviderKosten, basicPrijsGemiddeld, proPrijsGemiddeld, teamBasisGemiddeld, teamPerGebruikerGemiddeld }
}
