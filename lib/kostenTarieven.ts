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
  // Hoofdchat (Sonnet 4.6 met toolrondes, plus Haiku-herschrijving en moderatie), $ per bericht. Was 0,015, daarna 0,10 en 0,07
  // (19 november, op een enkel gemeten bericht). Sinds 28 november 0,09: gemeten uit arnobot_ai_gebruik (bronnen chat-*), 34 vragen van
  // echte gebruikers van 24 t/m 28 november gemiddeld $0,088. Vanaf 19 november (59 vragen) was het $0,117. Kleine meting, bewust niet
  // te gunstig. Bij meer verkeer kan het lager uitvallen doordat de vaste instructie vaker uit de cache komt, hoeveel is niet gemeten.
  anthropicPerBericht: 0.09,
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
  // Een gesprek afsluiten (samenvatting, feiten, geheugentoets, groeibalans, uitdaging, thema's, mailpatroon, entiteiten, labels), $ per
  // gesprek. Gemeten uit arnobot_ai_gebruik, 19 t/m 28 november 2026, zonder testaccounts: $2,30 voor 13 gesprekken met 57 vragen, bij 44
  // verwerkingen, omdat elk wegklikken de keten opnieuw draaide. Sinds 28 november gebeurt dat na 30 minuten stilte. Nagerekend op
  // dezelfde berichten zijn dat ongeveer 22 verwerkingen, dus de helft: $0,089 per gesprek. Later op 28 november ging de samenvatting
  // voor iedereen naar Sonnet 5.5 en kreeg de geheugentoets twee aanroepen: voorzichtig geschat $0,027 extra per verwerking, maal 22 op
  // 13 gesprekken is $0,046, samen $0,135. SCHATTING op een kleine meting met veel testdagen: na een paar dagen opnieuw meten (bronnen
  // sessie-*, geheugen-*, groeibalans, mail-patroon, blog-redenen). Geldt voor alle gebruikers, ook Basic.
  afsluitKostenPerGesprekUsd: 0.135,
  // 57 vragen in 13 gesprekken, dezelfde meting. Over alle gesprekken van echte gebruikers zonder de eigenaar was het 5,5.
  vragenPerGesprek: 4.4,
  // Vangnet voor de overige kleine Anthropic-routes (coaching-precheck, blog-synthese, verfijn, sessies-zoeken), $ per gebruiker/maand.
  // Stond van 19 t/m 28 november op 0,21 inclusief het afsluiten van gesprekken, dat is nu een eigen post hierboven.
  overigeAnthropicPerGebruikerPerMaand: 0.07,
  // Wekelijkse waarheidscontrole (lib/waarheidsRapport.ts): platformwerk zonder gebruiker. Gemeten op de ene run van 23 november 2026:
  // $5,086 voor 102 beoordelingen plus $0,196 voor 101 taalcontroles, dus $0,052 per antwoord. Eén week is weinig: bijwerken uit de bronnen
  // waarheidscontrole en waarheidscontrole-taal in Abacus (tab Trackrecord). De grens per run gebruikt de controle zelf ook.
  waarheidsControlePerAntwoordUsd: 0.052,
  waarheidsControleMaxPerWeek: 120,
  // ElevenLabs: credits per teken (Flash v2.5). ElevenLabs zelf bevestigt alleen
  // een bereik van 0,5-1, dit is de veilige kant van dat bereik.
  creditPerTeken: 1.0,
  tekensPerVoiceAntwoord: 500,
  // Transcriptie (gpt-transcribe, eerder Whisper) + korte Anthropic-voice-call, $ per voice-interactie
  kostenPerVoiceInteractie: 0.004,
  // Dicteren in de chat en bij Sparren (spraak naar tekst, alle plannen). OpenAI, $ per minuut,
  // pricing-pagina 2026-11-01: gpt-transcribe 0,0045 (gewone transcriptie na het stoppen en
  // terugval), gpt-live-transcribe 0,017 (tekst verschijnt terwijl je praat).
  dicteerPerMinuutUsd: 0.0045,
  dicteerLivePerMinuutUsd: 0.017,
  // AssemblyAI: audiobijlage-transcriptie + sprekersherkenning in de hoofdchat
  // (lib/assemblyai.ts, Pro/Team-only, "hidden" feature sinds 2026-09-17, geen
  // eigen pagina/aankondiging). universal-3-5-pro $0,21/uur + standaard
  // diarization $0,02/uur = $0,23/uur, omgerekend naar $/minuut. Nog geen
  // gemeten gebruik (feature net gebouwd), dus de twee volume-aannames
  // hieronder (DEFAULT_INPUTS) zijn een voorzichtige placeholder, geen
  // gemeten data zoals bij de andere routes.
  assemblyaiPerMinuut: 0.23 / 60,
  // Anthropic-tarieven Sonnet 4.6 per 1M tokens (lijst in de claude-api-skill, cache van 2026-11-03, gelezen 2026-11-19).
  // Een cache-lezing kost 0,1 keer de invoerprijs, een cache-schrijving 1,25 keer. De chat gebruikt voor bijlagen
  // GEEN prompt caching (de systeemprompt verandert per beurt, dus de bijlage kan niet voor de wisselende context staan).
  sonnetInvoerPerMiljoenUsd: 3,
  sonnetUitvoerPerMiljoenUsd: 15,
  // Documenten in de chat (docs/DOCUMENTEN_PLAN.md, live sinds 2026-11-18). Het hele bestand gaat bij ELKE beurt van
  // het gesprek opnieuw als invoer mee (tot 48 uur na het laatste bericht). Een PDF kost ruwweg 1.500 tot 3.000 tokens
  // per pagina (bron: Anthropic pdf-support, in DOCUMENTEN_PLAN gelezen 2026-11-18), harde grens 50 pagina's per PDF (was 100, herzien 2026-11-19)
  // en 20 MB. ALLES HIERONDER IS AANNAME: gemeten zijn alleen 10 documenten van 4 gebruikers in twee dagen
  // (mediaan 4 MB, 7 pdf, 1 afbeelding, 2 audio). Bijwerken zodra er een maand echt gebruik is (arnobot_documenten).
  pctDocumentGebruikers: 30,
  documentenPerGebruikerPerMaand: 3,
  tokensPerDocument: 40000,
  beurtenPerDocument: 5,
  // Vervolgrondes in een beurt (rekentool, tabeltool, groeidoel) sturen de bijlage opnieuw mee.
  toolRondeFactor: 1.3,
  pctDocumentenBewaard: 100,
  // Samenvatting per bewaard document (lib/documentSamenvatting.ts, Sonnet 4.6, max 1.200 uitvoertokens).
  samenvattingUitvoerTokens: 600,
  // Samenvattingen terugbrengen in het geheugen (3 stuks van ongeveer 400 tokens) bij een deel van de berichten van wie documenten bewaart.
  samenvattingBerichtenPerGebruiker: 20,
  samenvattingTokensPerBericht: 1200,
  // Profiel uit een andere AI (lib/historieImport.ts, achter HISTORIE_IMPORT_OPEN): omzetting eenmalig met Haiku
  // (maximaal 20.000 tekens in, 4.500 tokens uit, ruim 2 cent), en het profiel gaat daarna bij elk bericht mee in het
  // niet-gecachete deel van de systeemprompt (maximaal 6.800 tekens per profiel, ongeveer 2.000 tokens).
  pctHistorieImport: 20,
  kostenPerHistorieImport: 0.02,
  tokensHistorieProfiel: 2000,
  // Voyage AI rerank (rerank-2.5, lib/rag.ts): $0,05 per 1M tokens (docs.voyageai.com/docs/pricing, gelezen 2026-11-16). Het aantal
  // tokens is sinds 28 november teruggerekend uit de meting (bron rag-rerank, echte gebruikers, 19 t/m 28 november): $0,015 per
  // chatvraag, dus 300.000 tokens. Daarin zit alle rerank, ook buiten de chatvraag zelf (zoals blogtips bij het afsluiten, die niet in
  // de afsluitkosten zitten). Eerder geschat op 70.000. Geen gratis tokens meegerekend: de pagina van Voyage spreekt zichzelf daarover
  // tegen. Embeddings niet meegeteld (verwaarloosbaar: een zoekvraag is zo'n 30 tokens).
  voyageRerankPerMiljoenUsd: 0.05,
  rerankTokensPerBericht: 300000,
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
  // Compute per project (Micro, 720 uur x $0,01344) en het Pro-tegoed van $10 per maand, volgens
  // de factuur van 2026-10-10 (LJURUH-00009): 2 projecten, 25 + 2 x 9,68 - 10 = $34,35.
  // Zet supabaseProjecten op 1 als het tweede project is verwijderd.
  supabaseServerUsd: 9.68,
  supabaseProjecten: 2,
  supabaseTegoedUsd: 10,
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
  // Resend (transactionele mail): Pro is $20/maand voor 50.000 mails, geen daglimiet, daarboven $0,90 per
  // 1.000 (resend.com/pricing, gelezen via een zoekresultaat op 2026-11-04, de pagina zelf niet geopend:
  // controleer bij de kwartaalcheck). Het gratis plan heeft 100 mails per dag en 3.000 per maand (Settings,
  // Usage, 2026-11-04). Besloten 2026-11-04: upgraden op 2026-11-19, vóór de lancering van 2026-11-20 (elke
  // aanmelding geeft in 30 dagen zo'n 5 tot 6 trialmails, plus betaal- en nudgemails). Staat op actief als
  // gepland: zet op false zolang de upgrade niet is gedaan. Zelfde patroon als clerkProActief.
  resendProUsd: 20,
  resendProActief: true,
  resendInbegrepen: 50000,
  resendOveragePer1000Usd: 0.9,
  // Schatting, niet gemeten: bijwerken met het echte verbruik uit Resend, Settings, Usage.
  resendMailsPerGebruikerPerMaand: 6,
  // Moneybird (boekhouding, gekoppeld aan Mollie): Start-pakket, €18 excl. btw per maand bij
  // maandelijkse betaling (jaarlijks €15), besloten door Arno 2026-11-04 bij het afsluiten na de
  // proefperiode (eerste incasso 2026-12-09). Start: 1 gebruiker en 20 verwerkte banktransacties per
  // maand. De eerste 30 dagen zijn er alleen proefgebruikers, dus pas vanaf eind december lopen er
  // betalingen: bij de maandcheck Instellingen, Abonnement, Verbruik bekijken en zo nodig naar Groei
  // (€35, 50 transacties) of Compleet (€49, onbeperkt). Eerder was hier Groei €35 aangenomen
  // (2026-09-29). Altijd meegeteld, geen toggle
  // (besloten 2026-09-29, was eerst `moneybirdActief` net als Clerk Pro, maar
  // dit account staat altijd aan zodra het bestaat, geen optioneel scenario
  // zoals Clerk Pro's inactivity-timeout-afweging). EUR-native, geen fx nodig
  // in vasteKostenPerMaand/computeScenarioKosten behalve de omrekening naar de
  // dollar-context daar (zelfde patroon als sentryEur).
  moneybirdEur: 18,
  // Revolut Business (zakelijke rekening voor de Mollie-uitbetalingen): Basic-plan,
  // vanaf €10/maand volgens revolut.com/en-NL/business/business-account-plans
  // (gelezen via zoekresultaat 2026-10-13, de pagina zelf gaf een 403). Besloten
  // 2026-10-13: als vaste kost meetellen, ook al is het klein. Verworpen: Grow
  // (€35), pas relevant bij veel uitgaande betalingen of teamkaarten. Wisselkoers-
  // marge op USD-leveranciers is niet meegerekend. EUR-native, zelfde patroon als
  // moneybirdEur.
  revolutBusinessEur: 10,
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
  // prijsBasisEur/prijsPremiumEur: 29/49 (Pro verlaagd van 59, besloten
  // 2026-11-26, zie docs/PRICING_DECISIONS.md), gelijk aan
  // SCENARIO_PRIJZEN.basicMaandelijks/proMaandelijks hieronder.
  prijsBasisEur: 29,
  prijsPremiumEur: 49,
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
// Pro-plan plus de servers van alle projecten, min het maandelijkse Pro-tegoed (dat nooit negatief wordt).
export function supabaseBasisKosten(): number {
  return TARIEVEN.supabaseProUsd
    + Math.max(0, TARIEVEN.supabaseProjecten * TARIEVEN.supabaseServerUsd - TARIEVEN.supabaseTegoedUsd)
}

// Resend-kosten boven de 50.000 inbegrepen mails van Pro. Zonder Pro (gratis plan) is er geen
// overschrijding mogelijk, Resend weigert dan de mails (daglimiet 100, maandlimiet 3.000).
export function resendOverageUsd(
  gebruikers: number,
  mailsPerGebruiker: number = TARIEVEN.resendMailsPerGebruikerPerMaand,
  pro: boolean = TARIEVEN.resendProActief,
): number {
  if (!pro) return 0
  const overschot = Math.max(0, gebruikers * mailsPerGebruiker - TARIEVEN.resendInbegrepen)
  return (overschot / 1000) * TARIEVEN.resendOveragePer1000Usd
}

/**
 * De wekelijkse controle beoordeelt elk chatantwoord met een bewaarde bron, tot de grens per run. Hier telt elk chatbericht als zo'n antwoord,
 * dus onder de grens is dit aan de hoge kant. Een maand is 52/12 runs.
 */
export function waarheidsControleKostenUsd(chatberichtenPerMaand: number, perAntwoordUsd: number = TARIEVEN.waarheidsControlePerAntwoordUsd): number {
  return Math.min(chatberichtenPerMaand, TARIEVEN.waarheidsControleMaxPerWeek * 52 / 12) * perAntwoordUsd
}

export function afsluitKostenUsd(vragen: number, vragenPerGesprek: number = TARIEVEN.vragenPerGesprek, perGesprekUsd: number = TARIEVEN.afsluitKostenPerGesprekUsd): number {
  return vragenPerGesprek > 0 ? (vragen / vragenPerGesprek) * perGesprekUsd : 0
}

export function vasteKostenPerMaand(gebruikersAantal: number, fxRate: number = TARIEVEN.fxRateEurUsd): number {
  return TARIEVEN.vercelSeats * TARIEVEN.vercelPerSeat
    + (TARIEVEN.supabaseProActief ? supabaseBasisKosten() : 0)
    + (gebruikersAantal >= TARIEVEN.supabasePitrDrempel ? TARIEVEN.supabasePitrUsd : 0)
    + (TARIEVEN.clerkProActief ? TARIEVEN.clerkProUsd : 0)
    + (TARIEVEN.resendProActief ? TARIEVEN.resendProUsd : 0)
    + TARIEVEN.moneybirdEur * fxRate
    + TARIEVEN.revolutBusinessEur * fxRate
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
// Voyage-rerankkosten per chatbericht in dollars, afgeleid van de twee tarieven in TARIEVEN.
export function voyageKostenPerBericht(): number {
  return (TARIEVEN.rerankTokensPerBericht / 1_000_000) * TARIEVEN.voyageRerankPerMiljoenUsd
}

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
  vragenPerGesprek: number
  afsluitKostenPerGesprek: number
  waarheidsControlePerAntwoord: number
  pctVoice: number
  voiceInteracties: number
  tekensPerAntwoord: number
  creditPerTeken: number
  kostenPerInteractie: number
  pctAudioAnalyse: number
  audioMinutenPerGebruiker: number
  assemblyaiPerMinuut: number
  voyagePerBericht: number
  sonnetInvoerPerMiljoen: number
  sonnetUitvoerPerMiljoen: number
  pctDocumentGebruikers: number
  documentenPerGebruiker: number
  tokensPerDocument: number
  beurtenPerDocument: number
  toolRondeFactor: number
  pctDocumentenBewaard: number
  samenvattingUitvoerTokens: number
  samenvattingBerichtenPerGebruiker: number
  samenvattingTokensPerBericht: number
  pctHistorieImport: number
  kostenPerHistorieImport: number
  tokensHistorieProfiel: number
  dicteerMinutenPerGebruiker: number
  pctDicteerLive: number
  dicteerPerMinuut: number
  dicteerLivePerMinuut: number
  tiers: Tier[]
  vercelSeats: number
  vercelPerSeat: number
  supabasePro: boolean
  clerkPro: boolean
  resendPro: boolean
  resendMailsPerGebruiker: number
  moneybirdEur: number
  revolutBusinessEur: number
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
  vragenPerGesprek: TARIEVEN.vragenPerGesprek,
  afsluitKostenPerGesprek: TARIEVEN.afsluitKostenPerGesprekUsd,
  // Vangnet voor de rest van de modelinventaris: coaching-precheck, blog-synthese, verfijn, sessies-zoeken. Stuk voor stuk
  // verwaarloosbaar (Haiku of korte Sonnet-calls), hier samengevoegd i.p.v.
  // elke route apart te modelleren.
  overigeAnthropicPerGebruiker: TARIEVEN.overigeAnthropicPerGebruikerPerMaand,
  waarheidsControlePerAntwoord: TARIEVEN.waarheidsControlePerAntwoordUsd,
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
  voyagePerBericht: voyageKostenPerBericht(),
  sonnetInvoerPerMiljoen: TARIEVEN.sonnetInvoerPerMiljoenUsd,
  sonnetUitvoerPerMiljoen: TARIEVEN.sonnetUitvoerPerMiljoenUsd,
  pctDocumentGebruikers: TARIEVEN.pctDocumentGebruikers,
  documentenPerGebruiker: TARIEVEN.documentenPerGebruikerPerMaand,
  tokensPerDocument: TARIEVEN.tokensPerDocument,
  beurtenPerDocument: TARIEVEN.beurtenPerDocument,
  toolRondeFactor: TARIEVEN.toolRondeFactor,
  pctDocumentenBewaard: TARIEVEN.pctDocumentenBewaard,
  samenvattingUitvoerTokens: TARIEVEN.samenvattingUitvoerTokens,
  samenvattingBerichtenPerGebruiker: TARIEVEN.samenvattingBerichtenPerGebruiker,
  samenvattingTokensPerBericht: TARIEVEN.samenvattingTokensPerBericht,
  pctHistorieImport: TARIEVEN.pctHistorieImport,
  kostenPerHistorieImport: TARIEVEN.kostenPerHistorieImport,
  tokensHistorieProfiel: TARIEVEN.tokensHistorieProfiel,
  // Dicteren: nog geen gemeten gebruik, voorzichtige startwaarde van 30 minuten per gebruiker per
  // maand (alle gebruikers, ook Basic). Live is de bedoelde standaard, dus 100%. Bijwerken zodra er
  // echte cijfers zijn.
  dicteerMinutenPerGebruiker: 30,
  pctDicteerLive: 100,
  dicteerPerMinuut: TARIEVEN.dicteerPerMinuutUsd,
  dicteerLivePerMinuut: TARIEVEN.dicteerLivePerMinuutUsd,
  tiers: TARIEVEN.tiers,
  vercelSeats: TARIEVEN.vercelSeats,
  vercelPerSeat: TARIEVEN.vercelPerSeat,
  // Bevestigd 2026-08-10 daadwerkelijk geüpgraded. Sinds 2026-08-11 (audit)
  // niet meer los hardgecodeerd, maar dezelfde bron als vasteKostenPerMaand().
  supabasePro: TARIEVEN.supabaseProActief,
  clerkPro: TARIEVEN.clerkProActief,
  resendPro: TARIEVEN.resendProActief,
  resendMailsPerGebruiker: TARIEVEN.resendMailsPerGebruikerPerMaand,
  moneybirdEur: TARIEVEN.moneybirdEur,
  revolutBusinessEur: TARIEVEN.revolutBusinessEur,
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

  const voyageKosten = totaalBerichten * inputs.voyagePerBericht

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

  // Afsluiten van gesprekken: het aantal gesprekken beweegt mee met het aantal vragen, voor alle gebruikers (ook Basic).
  const afsluitKosten = afsluitKostenUsd(totaalBerichten, inputs.vragenPerGesprek, inputs.afsluitKostenPerGesprek)

  const voiceGebruikers = proEffectief * (inputs.pctVoice / 100)
  const totaalInteracties = voiceGebruikers * inputs.voiceInteracties
  const totaalTekens = totaalInteracties * inputs.tekensPerAntwoord
  const creditsNodig = totaalTekens * inputs.creditPerTeken
  const eleven = elevenLabsCost(creditsNodig, inputs.tiers)
  const whisperKosten = totaalInteracties * inputs.kostenPerInteractie

  // Dicteren (OpenAI spraak naar tekst) geldt voor alle gebruikers, niet alleen Pro/Team: de
  // microfoon zit in elk plan. Deel live (duurder) en deel gewoon, instelbaar.
  const liveDeel = inputs.pctDicteerLive / 100
  const dicteerKosten = n * inputs.dicteerMinutenPerGebruiker
    * (liveDeel * inputs.dicteerLivePerMinuut + (1 - liveDeel) * inputs.dicteerPerMinuut)

  // Audiobijlage-analyse (AssemblyAI): net als Voice alleen voor Pro/Team
  // (proEffectief), Basic heeft hier geen toegang toe (app/api/chat/route.ts,
  // 'audio_alleen_betaald').
  const audioAnalyseGebruikers = proEffectief * (inputs.pctAudioAnalyse / 100)
  const audioAnalyseKosten = audioAnalyseGebruikers * inputs.audioMinutenPerGebruiker * inputs.assemblyaiPerMinuut

  // Documenten in de chat: elke beurt van een gesprek met een bijlage stuurt het hele bestand opnieuw als (niet gecachete) invoer,
  // plus een samenvatting per bewaard bestand en die samenvattingen in het geheugen. Geldt voor alle gebruikers (ook Basic).
  const invoerPerToken = inputs.sonnetInvoerPerMiljoen / 1_000_000
  const uitvoerPerToken = inputs.sonnetUitvoerPerMiljoen / 1_000_000
  const documentGebruikers = n * (inputs.pctDocumentGebruikers / 100)
  const aantalDocumenten = documentGebruikers * inputs.documentenPerGebruiker
  const bewaardDeel = inputs.pctDocumentenBewaard / 100
  const documentBeurtKosten = aantalDocumenten * inputs.tokensPerDocument * inputs.beurtenPerDocument * inputs.toolRondeFactor * invoerPerToken
  const samenvattingKosten = aantalDocumenten * bewaardDeel
    * (inputs.tokensPerDocument * invoerPerToken + inputs.samenvattingUitvoerTokens * uitvoerPerToken)
  const samenvattingGeheugenKosten = documentGebruikers * bewaardDeel
    * inputs.samenvattingBerichtenPerGebruiker * inputs.samenvattingTokensPerBericht * invoerPerToken
  const documentKosten = documentBeurtKosten + samenvattingKosten + samenvattingGeheugenKosten

  // Profiel uit een andere AI: eenmalige omzetting (Haiku) plus het profiel in elk chatbericht.
  const historieGebruikers = n * (inputs.pctHistorieImport / 100)
  const historieImportKosten = historieGebruikers
    * (inputs.kostenPerHistorieImport + inputs.berichten * inputs.tokensHistorieProfiel * invoerPerToken)

  const waarheidsControleKosten = waarheidsControleKostenUsd(totaalBerichten, inputs.waarheidsControlePerAntwoord)

  const upstashCommands = totaalBerichten * inputs.upstashPerBericht
  const upstashOverage = Math.max(0, upstashCommands - inputs.upstashFreeLimit)
  const upstashKosten = (upstashOverage / 100000) * inputs.upstashPrice

  const teamOverheadKosten = teamLeden * inputs.teamOverheadPerLid
  const resendOverageKosten = resendOverageUsd(n, inputs.resendMailsPerGebruiker, inputs.resendPro)

  const sentryUsd = inputs.sentryEur * inputs.fxRate
  const domeinPerMaand = inputs.domeinPerJaar / 12
  const moneybirdUsd = inputs.moneybirdEur * inputs.fxRate
  const revolutUsd = inputs.revolutBusinessEur * inputs.fxRate
  const vastKosten = inputs.vercelSeats * inputs.vercelPerSeat
    + (inputs.supabasePro ? supabaseBasisKosten() : 0)
    + (n >= TARIEVEN.supabasePitrDrempel ? TARIEVEN.supabasePitrUsd : 0)
    + (inputs.clerkPro ? TARIEVEN.clerkProUsd : 0)
    + (inputs.resendPro ? TARIEVEN.resendProUsd : 0)
    + moneybirdUsd
    + revolutUsd
    + sentryUsd
    + domeinPerMaand

  const totaal = vastKosten + anthropicKosten + analysesKosten + fable5Kosten + sparringKosten + overigeAnthropicKosten + afsluitKosten
    + voyageKosten + eleven.price + whisperKosten + dicteerKosten + audioAnalyseKosten + documentKosten + historieImportKosten + upstashKosten + resendOverageKosten + teamOverheadKosten + waarheidsControleKosten

  return {
    vastKosten, anthropicKosten, voyageKosten, analysesKosten, fable5Kosten, sparringKosten, overigeAnthropicKosten, afsluitKosten,
    elevenPrice: eleven.price, elevenName: eleven.name,
    whisperKosten, dicteerKosten, audioAnalyseKosten, documentKosten, documentBeurtKosten, samenvattingKosten, samenvattingGeheugenKosten, historieImportKosten, upstashKosten, resendOverageKosten, teamOverheadKosten, waarheidsControleKosten, totaal, perGebruiker: n > 0 ? totaal / n : 0,
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
// gemiddeldeLeden = teamleden per account, zonder de manager (die zit in het
// managerbedrag, herzien 2026-11-26). Voor kosten en aantallen gebruikers telt
// de manager wel mee: hij chat en coacht ook.
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
// prijsPremiumEur hierboven horen bij dezelfde bron (sinds 2026-11-26:
// Basic 29/228, Pro 49/396). Sinds 2026-08-10 importeert app/prijzen/PrijzenClient.tsx deze
// constanten direct, dezelfde bron, geen losse hardgecodeerde bedragen meer.
export const SCENARIO_PRIJZEN: ScenarioPrijzen = { basicMaandelijks: 29, basicJaarlijksTotaal: 228, proMaandelijks: 49, proJaarlijksTotaal: 396 }
export const DEFAULT_BILLING_SPLIT: ScenarioBillingSplit = { basicPctJaarlijks: 40, proPctJaarlijks: 10 }
export const DEFAULT_TIER_VERDELING: TierVerdeling = { basic: 80, pro: 20 }
export const DEFAULT_BETAALPROVIDER: Betaalprovider = {
  mdrPct: 1.8, mdrFixed: 0.25, pctCreditcard: 25,
  sepaPct: 0, sepaFixed: 0.35,
  teamFixed: 0.25,
}
// Team-tarief (herzien 2026-11-26): €97 voor de manager, inclusief eigen Pro,
// + €49 per teamlid per maand; bij jaarlijkse vooruitbetaling €77 + €33 als
// maand-equivalent. Een teamlid betaalt hetzelfde als een solo Pro-klant, zie
// lib/teamPricing.ts. Zelfde structuur als ScenarioPrijzen hierboven.
// perGebruiker* is de prijs per teamlid, de manager niet meegerekend.
export type ScenarioTeamPrijzen = {
  basisMaandelijks: number; basisJaarlijksTotaal: number
  perGebruikerMaandelijks: number; perGebruikerJaarlijksTotaal: number
}
export const SCENARIO_TEAM_PRIJS: ScenarioTeamPrijzen = {
  basisMaandelijks: 97, basisJaarlijksTotaal: 924,
  perGebruikerMaandelijks: 49, perGebruikerJaarlijksTotaal: 396,
}
export const DEFAULT_TEAM_SCENARIO: TeamScenario = { aantalKlanten: 5, gemiddeldeLeden: 4 }
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
  // teamLeden = alle personen in teams (managers inbegrepen), voor kosten en aantallen. De omzet hieronder rekent per
  // teamlid zonder manager.
  const teamLeden = team.aantalKlanten * (team.gemiddeldeLeden + 1)
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
