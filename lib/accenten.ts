// Haalt accenten weg die het model gebruikt om een woord te benadrukken ("écht", "wéér", "dát",
// "zó", "én"). Die zijn in de tekst van ArnoBot niet gewenst. Accenten die de uitspraak of
// betekenis dragen blijven staan: "één" (tegenover "een"), een trema ("geïdentificeerd",
// "reële", "ideeën") en gangbare leenwoorden ("café"). De prompts vragen het model dit zelf te
// doen, maar dat gaat niet altijd goed, daarom ook deze vaste controle achteraf.
const TOEGESTAAN = new Set([
  'één', 'café', 'cafés', 'cliché', 'clichés', 'résumé', 'entrée', 'soirée', 'fiancé', 'coupé',
])

const BASIS: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u',
  Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', À: 'A', È: 'E', Ì: 'I', Ò: 'O', Ù: 'U',
}

export function stripEmphasisAccents(tekst: string): string {
  return tekst.replace(/[\p{L}]+/gu, woord => {
    if (!/[áéíóúàèìòùÁÉÍÓÚÀÈÌÒÙ]/.test(woord)) return woord
    if (TOEGESTAAN.has(woord.toLowerCase())) return woord
    return woord.replace(/[áéíóúàèìòùÁÉÍÓÚÀÈÌÒÙ]/g, c => BASIS[c])
  })
}
