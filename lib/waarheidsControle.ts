import Anthropic from '@anthropic-ai/sdk'

// Waarheidscontrole: beoordeelt een antwoord van ArnoBot op beweringen die niet gedekt zijn door
// de bron (blogfragmenten, wat de gebruiker zelf vertelde, vaste feiten over Arno). Gebruikt door de
// dagelijkse steekproef voor Arno (zie docs/CLAUDE_HISTORY.md, 2026-11-13). Cite-first: een bewering
// is alleen gedekt als er een letterlijk citaat bij staat. Een model uit dezelfde familie als de bot
// ziet anders "plausibel" snel als "gedekt".

export type BeweringCategorie = 'feit_cijfer' | 'over_arno_of_arnobot' | 'over_gebruiker' | 'algemene_kennis'
export type Ernst = 'hoog' | 'middel' | 'laag'

export type Bewering = {
  zin: string
  categorie: BeweringCategorie
  steun: string | null
  gedekt: boolean
  ernst: Ernst
}

export type Oordeel = { beweringen: Bewering[]; fout?: string }

export const WAARHEIDS_PROMPT = `Je controleert een antwoord van ArnoBot, een AI-coach die in de ik-vorm namens Arno Diepeveen antwoordt. Je krijgt de vraag, het antwoord, eerdere berichten van de gebruiker in dit gesprek, BRONFRAGMENTEN uit Arno's kennisbank en VASTE FEITEN.

Zoek in het antwoord elke concrete bewering die niet gewoon advies, oordeel of redenering is: cijfers, percentages, namen, onderzoeken, gebeurtenissen, wat "ik" (Arno) zelf heeft gedaan, meegemaakt, geschreven of gezegd, en beweringen over bedrijven of personen.

Voor elke bewering: citeer letterlijk het stuk uit de bronfragmenten, de gebruikersberichten of de vaste feiten dat haar dekt. Staat er geen letterlijke dekking, dan is de bewering ongedekt.

Let op toeschrijving: staat een gebeurtenis in een fragment over een ander persoon (een adviseur, klant, partner) en vertelt het antwoord haar als eigen verhaal van Arno, dan is dat ongedekt en categorie over_arno_of_arnobot.

Categorieën, voor elke bewering die niet gedekt is door de bron:
- feit_cijfer: een cijfer, percentage, naam, onderzoek of gebeurtenis die als feit wordt gepresenteerd.
- over_arno_of_arnobot: een bewering over Arno (zijn verleden, bedrijven, prestaties, wat hij heeft gedaan of gezegd) of over ArnoBot (hoe het werkt, wat het kost, waarvoor het is gebouwd).
- over_gebruiker: een bewering over de gebruiker of zijn zaak die niet uit zijn eigen woorden, documenten of het geheugen komt.
- algemene_kennis: algemeen bekende vakkennis of methodes (zoals SPIN of BANT) die niet uit Arno's bibliotheek komt maar wel in zijn naam wordt gezegd.

Antwoord alleen met JSON in deze vorm: {"beweringen":[{"zin":"...","categorie":"feit_cijfer|over_arno_of_arnobot|over_gebruiker|algemene_kennis","steun":"letterlijk citaat of null","gedekt":true,"ernst":"hoog|middel|laag"}]}

Ernst hoog: ongedekte feit_cijfer of over_arno_of_arnobot. Ernst middel: ongedekte over_gebruiker. Ernst laag: algemene_kennis, of een bewering die gedekt is. Neem gedekte beweringen alleen op als ze een cijfer, naam of feit bevatten. Zijn er geen beweringen: een lege lijst.`

export type ControleInvoer = {
  vraag: string
  antwoord: string
  eerdereBerichten: string[] // alleen wat de gebruiker zelf eerder zei in dit gesprek
  bron: string // de context die het model kreeg (fragmenten, geheugen, profiel)
  vasteFeiten: string
}

export function parseOordeel(tekst: string): Oordeel {
  try {
    const json = tekst.slice(tekst.indexOf('{'), tekst.lastIndexOf('}') + 1)
    const o = JSON.parse(json) as Oordeel
    return Array.isArray(o.beweringen) ? o : { beweringen: [], fout: 'geen beweringen-lijst' }
  } catch {
    return { beweringen: [], fout: 'JSON niet leesbaar' }
  }
}

export async function beoordeelAntwoord(invoer: ControleInvoer, client?: Anthropic): Promise<Oordeel> {
  const c = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await c.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: WAARHEIDS_PROMPT,
    messages: [
      {
        role: 'user',
        content: `VASTE FEITEN:\n${invoer.vasteFeiten}\n\nBRONFRAGMENTEN:\n${invoer.bron || '(geen)'}\n\nEERDERE BERICHTEN VAN DE GEBRUIKER:\n${invoer.eerdereBerichten.join('\n') || '(geen)'}\n\nVRAAG:\n${invoer.vraag}\n\nANTWOORD VAN ARNOBOT:\n${invoer.antwoord}`,
      },
    ],
  })
  const tekst = res.content.map(b => (b.type === 'text' ? b.text : '')).join('')
  return parseOordeel(tekst)
}

// ---- Taalcontrole: alleen echte fouten in het Nederlands ----
// Engelse woorden en uitdrukkingen zijn bewust toegestaan (zolang ze niet half vertaald zijn), gangbare
// Nederlandse uitdrukkingen en stijlkeuzes tellen niet. Zie docs/CLAUDE_HISTORY.md, 2026-11-13.

export type Taalfout = { zin: string; soort: 'grammatica' | 'woord' | 'onbegrijpelijk' | 'vertaald'; waarom: string }

export const TAAL_PROMPT = `Je controleert Nederlandse tekst van een AI-coach op echte taalfouten. Markeer alleen: grammaticale fouten (lidwoord, verbuiging, werkwoordsvorm, woordvolgorde), niet-bestaande woorden en zinnen die niet te volgen zijn. Markeer NIET: Engelse woorden, Engelse zinnen of Engelse uitdrukkingen (die zijn bewust toegestaan, zolang ze niet half vertaald zijn), gangbare Nederlandse uitdrukkingen, spreektaal en stijlkeuzes. Markeer wel een Engelse uitdrukking die letterlijk en onhandig in het Nederlands is vertaald. Antwoord alleen met JSON: {"fouten":[{"zin":"letterlijk uit de tekst","soort":"grammatica|woord|onbegrijpelijk|vertaald","waarom":"kort"}]}. Is er geen fout: een lege lijst.`

export async function beoordeelNederlands(antwoord: string, client?: Anthropic): Promise<{ fouten: Taalfout[]; fout?: string }> {
  const c = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await c.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1000, system: TAAL_PROMPT, messages: [{ role: 'user', content: antwoord }] })
  const tekst = res.content.map(b => (b.type === 'text' ? b.text : '')).join('')
  try {
    const o = JSON.parse(tekst.slice(tekst.indexOf('{'), tekst.lastIndexOf('}') + 1)) as { fouten?: Taalfout[] }
    return { fouten: Array.isArray(o.fouten) ? o.fouten : [] }
  } catch {
    return { fouten: [], fout: 'JSON niet leesbaar' }
  }
}
