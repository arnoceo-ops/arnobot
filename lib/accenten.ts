// Haalt accenten weg die het model gebruikt om een woord te benadrukken ("écht", "wéér", "dát",
// "zó", "én"). Die zijn in de tekst van ArnoBot niet gewenst. De prompts vragen het model dit zelf
// te laten, maar dat gaat niet altijd goed, daarom ook deze vaste controle achteraf.
//
// Alleen een accent op een gewoon Nederlands woord gaat eraf (de versie zonder accent staat in
// GEWONE_WOORDEN). Daardoor blijven staan: "één" (tegenover "een"), een trema ("geïdentificeerd",
// "reële", "ideeën"), leenwoorden ("café") en eigennamen ("René", "José"): die zonder accent zijn
// geen gewoon woord uit de lijst.
const TOEGESTAAN = new Set([
  'één', 'eén', 'café', 'cafés', 'cliché', 'clichés', 'résumé', 'entrée', 'soirée', 'fiancé', 'coupé',
])

const GEWONE_WOORDEN = new Set([
  'echt', 'weer', 'dat', 'zo', 'dit', 'en', 'wel', 'nog', 'hoe', 'dan', 'naar', 'ook', 'eerst', 'deze',
  'de', 'het', 'nooit', 'alles', 'alle', 'groot', 'geen', 'met', 'voor', 'van', 'is', 'er', 'nu', 'ze',
  'we', 'je', 'ik', 'wat', 'wie', 'waar', 'waarom', 'want', 'maar', 'als', 'dus', 'toch', 'altijd',
  'steeds', 'juist', 'precies', 'vooral', 'meer', 'minder', 'veel', 'weinig', 'goed', 'slecht',
  'beter', 'best', 'zelf', 'zelfs', 'pas', 'al', 'niet', 'wel', 'ja', 'nee', 'of', 'om', 'op', 'in',
  'aan', 'bij', 'uit', 'over', 'door', 'tot', 'te', 'ten', 'der', 'die', 'dan', 'die', 'daar', 'hier',
  'toen', 'wanneer', 'omdat', 'terwijl', 'zodat', 'hij', 'zij', 'jij', 'jou', 'jouw', 'mij', 'mijn',
  'hun', 'haar', 'ons', 'onze', 'uw', 'echte', 'ene', 'andere', 'enige', 'enkel', 'beide', 'samen',
  'alleen', 'gewoon', 'misschien', 'immers', 'ten', 'eens', 'even', 'ineens', 'reeds', 'sowieso',
  'niets', 'iets', 'iemand', 'niemand', 'ieder', 'elke', 'elk', 'zulke', 'zo', 'zoveel', 'zoiets',
])

const BASIS: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u',
  Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', À: 'A', È: 'E', Ì: 'I', Ò: 'O', Ù: 'U',
}

const ACCENT = /[áéíóúàèìòùÁÉÍÓÚÀÈÌÒÙ]/g

// Lengte blijft gelijk (één teken wordt één teken), dat is nodig voor de streaming-variant in
// lib/ai.ts, die op posities in de tekst werkt.
export function stripEmphasisAccents(tekst: string): string {
  return tekst.replace(/[\p{L}]+/gu, woord => {
    ACCENT.lastIndex = 0
    if (!ACCENT.test(woord)) return woord
    if (TOEGESTAAN.has(woord.toLowerCase())) return woord
    const zonder = woord.replace(ACCENT, c => BASIS[c])
    return GEWONE_WOORDEN.has(zonder.toLowerCase()) ? zonder : woord
  })
}
