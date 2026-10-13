// Roterende quotes voor de e-mailfooter (zie emailFooter in lib/email-templates.ts).
// Nieuwe quote toevoegen = een regel erbij, de rotatie past zich vanzelf aan.
// Geen streepjes als leesteken, wel altijd een bij naam bekende, verifieerbare bron.
export interface EmailQuote {
  tekst: string
  auteur: string
}

export const EMAIL_QUOTES: EmailQuote[] = [
  { tekst: 'Wat je tot hier bracht, brengt je er niet.', auteur: 'Marshall Goldsmith' },
  { tekst: 'We hebben allemaal mensen nodig die ons feedback geven. Zo worden we beter.', auteur: 'Bill Gates' },
  { tekst: 'Feedback is het ontbijt van kampioenen.', auteur: 'Ken Blanchard' },
  { tekst: 'Niet omdat het moeilijk is durven we het niet. Het is moeilijk omdat we het niet durven.', auteur: 'Seneca' },
  { tekst: 'We zijn wat we herhaaldelijk doen. Uitmuntendheid is dus geen daad, maar een gewoonte.', auteur: 'Will Durant' },
  { tekst: 'Je hoeft niet geweldig te zijn om te beginnen, maar je moet beginnen om geweldig te worden.', auteur: 'Zig Ziglar' },
  { tekst: 'Efficiency is dingen goed doen. Effectiviteit is de goede dingen doen.', auteur: 'Peter Drucker' },
  { tekst: 'Wat telt is wat je leert nadat je denkt dat je alles al weet.', auteur: 'John Wooden' },
]

/** Dagelijks wisselend, zonder opslag: dezelfde dag geeft dezelfde quote, de volgende dag de volgende. */
export function quoteVanVandaag(nu: Date = new Date()): EmailQuote {
  const dagNummer = Math.floor(nu.getTime() / 86_400_000)
  return EMAIL_QUOTES[dagNummer % EMAIL_QUOTES.length]
}
