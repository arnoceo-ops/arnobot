// Terugkerende gedragspatronen in ArnoBot-antwoorden, geteld over alle antwoorden van een week (geen AI-kosten, alleen tekstpatronen).
// Doel: zien of een aanpassing van de systeemprompt echt werkt en of dezelfde fout na een week terugkomt (verwatering). Elk patroon
// hoort bij een regel in lib/systemPrompt.ts of een tooluitleg. Een patroon is een signaal en geen oordeel: de mail toont voorbeelden
// zodat Arno kan zien of het een echte treffer is. Voeg een patroon alleen toe na een klacht die is aangepast, anders wordt de lijst ruis.

export type Gedragspatroon = { sleutel: string; naam: string; regel: string; test: RegExp }

export const GEDRAGSPATRONEN: Gedragspatroon[] = [
  {
    sleutel: 'aankondiging',
    naam: 'Aankondiging voor een hulpmiddel',
    regel: 'systeemprompt: rekenen en hulpmiddelen; tooluitleg schrijf_tabel_over',
    test: /^\s*(laat me|laten we even|eerst (de|het|even)\b|ik ga (eerst|even)\b|even (kijken|checken|controleren|nakijken)\b)/i,
  },
  {
    sleutel: 'zelfcorrectie',
    naam: 'Zelfcorrectie midden in het antwoord',
    regel: 'systeemprompt: rekenen',
    test: /(^|[.!?]\s+)(wacht|nee,? wacht|oeps|sorry,? andersom)\b/i,
  },
  {
    sleutel: 'bijval',
    naam: 'Bijval als opening (klopt helemaal, je hebt gelijk)',
    regel: 'systeemprompt: één lijn, eerst de feiten',
    test: /^\s*(klopt( helemaal| precies)?|je hebt (helemaal )?gelijk|absoluut|precies|inderdaad)\b/i,
  },
  {
    sleutel: 'verwachting-als-feit',
    naam: 'Doel als gehaald gepresenteerd',
    regel: 'systeemprompt: verwachting is geen feit',
    test: /\b(is (al )?binnen|geen vraag meer|je haalt (het|dat) (zeker|makkelijk))\b/i,
  },
  {
    sleutel: 'markt-voorspelling',
    naam: 'Voorspelling over de markt of een andere werkgever',
    regel: 'systeemprompt: vertrekvragen',
    test: /\b(de markt is bereid|andere (werkgevers|bedrijven) (zullen|willen|staan)|alle recht om (verder te kijken|weg te gaan))\b/i,
  },
]

export type PatroonTelling = { sleutel: string; naam: string; regel: string; aantal: number; voorbeelden: string[] }

/** Telt per patroon in hoeveel antwoorden het voorkomt (een antwoord telt maximaal één keer per patroon). */
export function telGedragspatronen(antwoorden: { answer: string }[]): PatroonTelling[] {
  return GEDRAGSPATRONEN.map(p => {
    const treffers = antwoorden.filter(a => p.test.test(a.answer))
    return {
      sleutel: p.sleutel,
      naam: p.naam,
      regel: p.regel,
      aantal: treffers.length,
      voorbeelden: treffers.slice(0, 2).map(a => a.answer.trim().split(/\n/)[0].slice(0, 160)),
    }
  })
}
