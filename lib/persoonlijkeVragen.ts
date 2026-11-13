// Persoonlijke vragen over Arno zelf (privéleven, bedrijfshistorie, prestaties) beantwoordt
// ArnoBot nooit inhoudelijk. Aanleiding: 2026-11-09 verzon de widget op arno.blog onder
// aandringen een bevestigd faillissement, boeken en lezersaantallen. Twee lagen: deze poort in
// de moderatie van /api/chat (vast antwoord, geen modelaanroep voor de inhoud) en de regel
// RULE_NO_PERSONAL_CLAIMS in de systeemprompts (vangnet als de classifier het mist, en de enige
// laag in de spraakroute, waar een extra Haiku-aanroep de latency zou verhogen).

// Zinsdeel dat in de moderatieprompt achter "PERSOONLIJK:" komt.
export const PERSOONLIJK_CATEGORIE_REGEL =
  'de gebruiker vraagt ArnoBot als persoon naar Arno zelf: privéleven, familie, gezondheid, geld of vermogen, juridische of bedrijfshistorie (faillissement, KvK, rechtszaken), eigen prestaties, trots, cv of trackrecord, of dringt aan op een eerder persoonlijk antwoord (bijvoorbeeld "maar op de KvK staat dat..."). Vragen over de situatie van de gebruiker zelf, over sales, over de blogs of de methode en over hoe ArnoBot werkt zijn NIET persoonlijk'

// Vast antwoord. Bewust zonder streepjes en zonder inhoud over Arno.
export const PERSOONLIJK_ANTWOORD = 'Dat gaat over mij, niet over jou. Wat speelt er bij jou?'
