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

// Goedkope poort voor de spraakroute, zonder modelaanroep (latency). Bewust smal: alleen
// formuleringen die Arno zelf als persoon aanspreken ("ben je failliet", "wat verdien jij").
// Een zin als "ik ben bang dat mijn bedrijf failliet gaat" hoort er NIET onder te vallen, die
// gaat over de gebruiker. Wat deze lijst mist, vangt de promptregel RULE_NO_PERSONAL_CLAIMS op.
const PERSOONLIJK_PATRONEN: RegExp[] = [
  /\b(ben|bent|was|werd)\s+(je|jij)\s+(ooit\s+|wel\s+eens\s+|echt\s+|zelf\s+)?(failliet|getrouwd|ziek|depressief|rijk|omgekocht|veroordeeld|gescheiden)/,
  /\b(arno|jouw\s+bv|jouw\s+bedrijf|jouw\s+bedrijven|je\s+bv|je\s+bedrijf)\b[^.?!]*\b(failliet|faillissement|opgeheven|ten\s+onder)/,
  /\b(kvk|kamer\s+van\s+koophandel)\b/,
  /\b(hoeveel|wat)\s+verdien\s+(je|jij)\b/,
  /\bwat\s+is\s+(je|jouw)\s+(salaris|vermogen|inkomen)\b/,
  /\bhoe\s+oud\s+ben\s+(je|jij)\b/,
  /\bwaar\s+woon\s+(je|jij)\b/,
  /\bheb\s+(je|jij)\s+(\w+\s+)?(kinderen|een\s+gezin|een\s+vrouw|een\s+man|een\s+rechtszaak|schulden)\b/,
  /\b(wat|welke)\s+(heb|hebt)\s+(je|jij)\s+(\w+\s+){0,3}(gepresteerd|bereikt)\b/,
  /\bwaar\s+ben\s+(je|jij)\s+(het\s+meest\s+)?trots\s+op\b/,
]

export function lijktPersoonlijk(vraag: string): boolean {
  const v = vraag.toLowerCase()
  return PERSOONLIJK_PATRONEN.some(p => p.test(v))
}
