/**
 * Proefversie van de afgedwongen geldstap (docs/GELDADVIES_PLAN.md). Alleen voor het examen, niet in de app.
 * Vier onderdelen: herkennen van een geldvraag, verplicht invullen (structured outputs), beslissing in code, controle vóór tonen.
 * De teksten bevatten bewust niets over de examengevallen zelf; ze komen uit Arno's algemene oordelen.
 */

export const HERKEN_SYSTEEM = `Je krijgt het laatste bericht van een gebruiker aan een salescoach, soms met het bericht daarvoor. Bepaal of een goed antwoord afhangt van geld: de gebruiker moet iets kiezen of beoordelen dat invloed heeft op prijs, korting, marge, omzet, kosten, salaris, vergoeding, contractvoorwaarden (looptijd, opzegging, betaling, garantie), iets gratis of extra leveren, investeren, of verlies en winst. Ook als er geen bedrag of geldwoord in staat. Niet: vragen over aanpak, gesprekstechniek, planning, motivatie, teamgedrag of een tekst, waarbij geen keuze over geld of voorwaarden speelt, ook als er toevallig een getal in staat. Twijfel je, antwoord dan true.`

export const HERKEN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['geldvraag'],
  properties: { geldvraag: { type: 'boolean' } },
}

const STATUS = {
  type: 'object', additionalProperties: false, required: ['status', 'waarde', 'bron'],
  properties: {
    status: { type: 'string', enum: ['bekend', 'onbekend', 'niet_van_toepassing'] },
    waarde: { type: 'string' },
    bron: { type: 'string', description: 'letterlijk citaat uit de tekst van de gebruiker waaruit dit blijkt, anders leeg' },
  },
}

export const GEGEVENS = ['klant_doorgaan', 'marge_draagt_het', 'kosten_bewegen_mee', 'tegenprestatie', 'aanleiding_van_de_klant'] as const

export const INVUL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['soort', 'bedragen', 'keuzes', 'gegevens', 'rekenfouten_in_de_tekst', 'ander_beslissend_onbekend'],
  properties: {
    soort: { type: 'string', enum: ['prijswijziging', 'korting_of_iets_weggeven', 'contractvoorwaarden', 'verlies_of_marge', 'berekening_of_plan', 'anders'] },
    bedragen: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['wat', 'waarde', 'wie_betaalt_wie', 'btw', 'periode', 'stand', 'herkomst', 'bron'],
        properties: {
          wat: { type: 'string' }, waarde: { type: 'string' }, wie_betaalt_wie: { type: 'string' },
          btw: { type: 'string', enum: ['inclusief', 'exclusief', 'onbekend', 'niet_van_toepassing'] },
          periode: { type: 'string' },
          stand: { type: 'string', enum: ['huidig', 'beginstand', 'toekomst', 'onbekend', 'niet_van_toepassing'] },
          herkomst: { type: 'string', enum: ['gegeven', 'aangenomen', 'berekend'] },
          bron: { type: 'string', description: 'bij gegeven: letterlijk citaat uit de tekst van de gebruiker' },
        },
      },
    },
    keuzes: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['keuze', 'geld_van_de_gebruiker', 'uitleg'],
        properties: {
          keuze: { type: 'string' },
          geld_van_de_gebruiker: { type: 'string', enum: ['levert_meer_op', 'kost_geld', 'gelijk', 'onbekend'], description: 'vergeleken met de andere keuze' },
          uitleg: { type: 'string' },
        },
      },
    },
    gegevens: { type: 'object', additionalProperties: false, required: [...GEGEVENS], properties: Object.fromEntries(GEGEVENS.map(g => [g, STATUS])) },
    rekenfouten_in_de_tekst: { type: 'array', items: { type: 'string' }, description: 'fouten in de vergelijking of som in wat de gebruiker aanlevert, met de juiste som' },
    ander_beslissend_onbekend: { type: 'array', items: { type: 'string' }, description: 'andere ontbrekende gegevens die het oordeel kunnen omdraaien' },
  },
}

export const INVUL_SYSTEEM = `Je vult een geldblad in voordat een salescoach antwoordt. Je geeft zelf geen advies. De gebruiker is de verkopende partij, tenzij de tekst iets anders zegt.
Regels:
1. Leg van elk bedrag vast wat het is: wie betaalt wie, met of zonder btw, welke periode, huidige stand of beginstand. Vergelijk alleen bedragen op dezelfde basis en reken ze zo nodig om (noem het gebruikte btw-tarief als aanname).
2. "gegeven" mag alleen met een letterlijk citaat van de gebruiker. Al het andere is aangenomen of berekend.
3. Beschrijf per keuze wat die met het geld van de gebruiker doet, vergeleken met de andere keuze. Een prijs verlagen kost de gebruiker geld; een verlaging niet doorvoeren levert meer op.
4. Een gegeven is alleen "bekend" als de gebruiker het zelf zegt. Tevredenheid van de klant zegt niet of de gebruiker met die klant door wil en kan. Een genoemd margepercentage zegt niet of de marge het draagt. Twijfel je, dan is het onbekend.
5. Eerdere antwoorden van de coach zijn geen feiten en kunnen fout zijn.`

// Welke onbekende gegevens het oordeel kunnen omdraaien, per soort geldvraag (Arno's oordelen van 27-11). De code beslist, niet het model.
export const BESLISSEND: Record<string, (typeof GEGEVENS)[number][]> = {
  prijswijziging: ['klant_doorgaan', 'kosten_bewegen_mee', 'marge_draagt_het'],
  korting_of_iets_weggeven: ['tegenprestatie', 'klant_doorgaan', 'marge_draagt_het'],
  contractvoorwaarden: ['aanleiding_van_de_klant'],
  verlies_of_marge: [],
  berekening_of_plan: [],
  anders: [],
}

export const GEGEVEN_VRAAG: Record<(typeof GEGEVENS)[number], string> = {
  klant_doorgaan: 'wil en kan de gebruiker met deze klant door, ook in een volgende ronde',
  marge_draagt_het: 'draagt de marge het',
  kosten_bewegen_mee: 'dalen de kosten mee of zijn die al gedaald',
  tegenprestatie: 'wat krijgt de gebruiker ervoor terug, welk commitment',
  aanleiding_van_de_klant: 'waarom vraagt de klant dit (eerst bellen, de klant wil mogelijk weg)',
}

export type Blad = {
  soort: string
  bedragen: { herkomst: string; bron: string }[]
  keuzes: unknown[]
  gegevens: Record<string, { status: string; waarde: string; bron: string }>
  rekenfouten_in_de_tekst: string[]
  ander_beslissend_onbekend: string[]
}

const plat = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** De code dwingt af: een citaat dat niet letterlijk in de tekst van de gebruiker staat, telt niet als gegeven of bekend. */
export function toetsBlad(blad: Blad, tekstGebruiker: string): { blad: Blad; open: (typeof GEGEVENS)[number][]; afgekeurdeCitaten: number } {
  const bron = plat(tekstGebruiker)
  const staatEr = (citaat: string) => {
    const delen = citaat.split(/\.\.\.|…/).map(plat).filter(Boolean)
    return delen.length > 0 && delen.every(d => bron.includes(d))
  }
  let afgekeurd = 0
  for (const b of blad.bedragen) if (b.herkomst === 'gegeven' && !staatEr(b.bron)) { b.herkomst = 'aangenomen'; afgekeurd++ }
  for (const g of Object.values(blad.gegevens)) if (g.status === 'bekend' && !staatEr(g.bron)) { g.status = 'onbekend'; afgekeurd++ }
  const open = (BESLISSEND[blad.soort] ?? []).filter(g => blad.gegevens[g]?.status === 'onbekend')
  return { blad, open, afgekeurdeCitaten: afgekeurd }
}

export function schrijfOpdracht(blad: Blad, open: (typeof GEGEVENS)[number][]): string {
  const kop = `GELDBLAD (ingevuld en gecontroleerd vóór dit antwoord; dit is je uitgangspunt en gaat voor op eerdere antwoorden en op de regels over vragen stellen hierboven. Noem het geldblad niet.)\n${JSON.stringify(blad)}`
  const basis = `Elk argument wijst dezelfde kant op als wat je zegt over het geld in "keuzes". Wat "aangenomen" is noem je als aanname, nooit als feit. Verzin geen feiten. Staat er iets bij "rekenfouten_in_de_tekst", begin daar dan mee, met de som. Je antwoord is kort. Zat een eerder antwoord ernaast, zeg dat in één zin.`
  if (open.length === 0) return `${kop}\n\n${basis}`
  return `${kop}\n\n${basis}\n\nBESLIST DOOR DE APP: je geeft nog GEEN oordeel over wat de gebruiker moet kiezen, ook niet voorlopig of tussen de regels. Zeg eerst kort wat al vaststaat (sommen en wat elke keuze met het geld doet). Vraag daarna in één korte alinea precies dit, in je eigen woorden: ${open.map(g => GEGEVEN_VRAAG[g]).join('; ')}. Zeg erbij hoe het antwoord je oordeel bepaalt.`
}

export const CONTROLE_SYSTEEM = `Je controleert het concept van een salescoach voordat de gebruiker het ziet. Je krijgt de tekst van de gebruiker, een gecontroleerd geldblad en het concept. Keur alleen af bij een echte fout:
1. omgedraaid: een argument of woordkeus wijst een andere kant op dan het advies of dan "keuzes" in het geldblad (bijvoorbeeld de keuze die geld oplevert "weggeven" noemen);
2. een bedrag of vergelijking die niet klopt of op een andere basis staat;
3. een aanname of verzinsel als feit gebracht;
4. staat in de opdracht dat er nog geen oordeel mag komen: er staat toch een oordeel in, of een van de gevraagde gegevens wordt niet gevraagd.
Stijl, toon en lengte beoordeel je niet. Noem per fout het letterlijke stuk en wat er niet klopt.`

export const CONTROLE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['akkoord', 'fouten'],
  properties: { akkoord: { type: 'boolean' }, fouten: { type: 'array', items: { type: 'string' } } },
}
