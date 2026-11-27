import type Anthropic from '@anthropic-ai/sdk'
import { voerGeldToolUit } from './geldTool'

// Geldcontrole vóór het antwoord (2026-11-27, docs/GELDADVIES_PLAN.md). Gemeten: staat een geldfunctie alleen als tool klaar,
// dan kiest het chatmodel bij een prijswijziging toch de gewone rekenmachine met de verkeerde som. Daarom beslist de app:
// een klein model haalt alleen de gegevens uit het gesprek, de code controleert dat de getallen van de gebruiker komen en
// rekent zelf, en het chatmodel krijgt de uitkomsten bij het bericht. Het kleine model rekent en adviseert niet.

export const GELDCHECK_SYSTEEM = `Je haalt gegevens uit een gesprek tussen een gebruiker en een salescoach, zodat de app er vaste berekeningen mee kan doen. Je rekent niet, je schat niet en je geeft geen advies.
geldvraag: true als een goed antwoord op het laatste bericht afhangt van geld: de gebruiker moet iets kiezen of beoordelen dat invloed heeft op prijs, korting, marge, omzet, een doel in geld, kosten, salaris, vergoeding, contractvoorwaarden (looptijd, opzegging, betaling, garantie), iets gratis of extra leveren, investeren, of verlies en winst, ook zonder bedrag of geldwoord. Niet: aanpak, gesprekstechniek, planning, motivatie, teamgedrag of een tekst zonder keuze over geld of voorwaarden. Twijfel je, antwoord true.
Kijk waar het laatste bericht van de gebruiker over gaat, met de eerdere berichten erbij. Vul alleen een lijst als die berekening daarvoor van belang is; anders blijft de lijst leeg.
- prijswijziging: de eigen verkoopprijs of omzet bij een klant gaat omhoog of omlaag (prijsverlaging, verhoging, indexering, korting op bestaande omzet) en dat speelt in het huidige onderwerp. omzet is de huidige omzet bij die klant of dat contract, niet de totale portefeuille en niet het bedrag van de wijziging. Ken je de omzet, geef dan wijziging_procent. Ken je alleen het bedrag van de wijziging, geef wijziging_bedrag (min bij verlaging).
- prijzen_vergelijken: twee of meer prijzen per dezelfde eenheid worden vergeleken en btw speelt (minstens een prijs is inclusief of exclusief genoemd). Neem ook voorgestelde nieuwe prijzen mee. Staat bij een prijs niet of die inclusief of exclusief is, gebruik "onbekend". btw_procent: het tarief dat de gebruiker noemt (bron "gebruiker"), anders het gewone tarief voor dit product in het land van de verkoop (bron "aanname"). In Nederland is dat 9% voor eten en niet-alcoholische dranken (ook frisdrank) en 21% voor de meeste andere producten en diensten; in Duitsland is het gewone tarief 19%.
- deel_van_totaal: een eigen cijfer (persoon, klant, regio) staat naast een team- of totaalcijfer, allebei met een stand van nu en van vorig jaar. deel_in_totaal is "ja" als het totaal dit deel meetelt, "nee" als het alleen de anderen zijn, anders "onbekend".
Alleen getallen die de gebruiker zelf heeft gegeven (in een bericht, geplakte tekst of bijlage). Eerdere antwoorden van de coach zijn geen bron en kunnen fout zijn. Ontbreekt een verplicht getal, laat de berekening dan weg. Schrijf bedragen voluit (45k is 45000).`

const prijs = {
  type: 'object', additionalProperties: false, required: ['naam', 'bedrag', 'btw'],
  properties: { naam: { type: 'string' }, bedrag: { type: 'number' }, btw: { type: 'string', enum: ['inclusief', 'exclusief', 'onbekend'] } },
}

export const GELDCHECK_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['geldvraag', 'prijswijziging', 'prijzen_vergelijken', 'deel_van_totaal'],
  properties: {
    geldvraag: { type: 'boolean' },
    prijswijziging: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: [],
        properties: { omzet: { type: 'number' }, wijziging_procent: { type: 'number' }, wijziging_bedrag: { type: 'number' }, marge_procent: { type: 'number' } },
      },
    },
    prijzen_vergelijken: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['prijzen', 'btw_procent', 'btw_procent_bron'],
        properties: { prijzen: { type: 'array', items: prijs }, btw_procent: { type: 'number' }, btw_procent_bron: { type: 'string', enum: ['gebruiker', 'aanname'] } },
      },
    },
    deel_van_totaal: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['totaal_nu', 'totaal_vorig', 'deel_nu', 'deel_vorig', 'deel_in_totaal', 'periode'],
        properties: {
          totaal_nu: { type: 'number' }, totaal_vorig: { type: 'number' }, deel_nu: { type: 'number' }, deel_vorig: { type: 'number' },
          deel_in_totaal: { type: 'string', enum: ['ja', 'nee', 'onbekend'] }, periode: { type: 'string', enum: ['gelijk', 'lopend_tegen_heel_jaar'] },
        },
      },
    },
  },
}

const MAX_PER_SOORT = 2

/** Alle getallen in de tekst van de gebruiker, ruim gelezen: 19,95 en 19.95, 600k, 10m, 2.271.804, -12%. */
export function getallenIn(tekst: string): number[] {
  const uit: number[] = []
  for (const m of tekst.matchAll(/(\d+(?:[.,  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(\s?(?:k|m|mio|miljoen|duizend)(?![\p{L}]))?/giu)) {
    const ruw = m[1]
    const lezingen = new Set<number>()
    // Beide notaties proberen: duizendtallen met punt, komma of spatie, en een komma of punt als decimaalteken.
    lezingen.add(Number(ruw.replace(/[  ]/g, '').replace(/\./g, '').replace(',', '.')))
    lezingen.add(Number(ruw.replace(/[  ,]/g, '')))
    for (const deel of ruw.split(/[  ]/)) lezingen.add(Number(deel.replace(',', '.')))
    const eenheid = m[2]?.trim().toLowerCase()
    const factor = !eenheid ? 1 : eenheid === 'k' || eenheid === 'duizend' ? 1e3 : 1e6
    for (const n of lezingen) if (Number.isFinite(n)) { uit.push(n); if (factor !== 1) uit.push(n * factor) }
  }
  return uit
}

function staatErin(n: number, bekend: number[]): boolean {
  const doel = Math.abs(n)
  return bekend.some(b => Math.abs(b - doel) < 0.005)
}

/** De getallen die van de gebruiker moeten komen. Het btw-tarief mag een aanname zijn en staat er daarom niet bij. */
function vereist(soort: string, invoer: Record<string, unknown>): unknown[] {
  if (soort === 'prijswijziging') return [invoer.omzet, invoer.wijziging_procent, invoer.wijziging_bedrag, invoer.marge_procent]
  if (soort === 'prijzen_vergelijken') return Array.isArray(invoer.prijzen) ? invoer.prijzen.map(p => (p as { bedrag?: unknown })?.bedrag) : []
  return [invoer.totaal_nu, invoer.totaal_vorig, invoer.deel_nu, invoer.deel_vorig]
}

export type GeldCheck = { blok: string; uitgevoerd: string[]; afgekeurd: string[] }

/**
 * Voert uit wat het kleine model vond. gebruikersTekst is alles wat de gebruiker zelf gaf; een berekening met een getal
 * dat daar niet in staat vervalt in zijn geheel. Geeft een leeg blok als er niets overblijft.
 */
export function voerGeldCheckUit(gevonden: unknown, gebruikersTekst: string): GeldCheck {
  const bekend = getallenIn(gebruikersTekst)
  const uitkomsten: string[] = []
  const uitgevoerd: string[] = []
  const afgekeurd: string[] = []
  for (const soort of ['prijswijziging', 'prijzen_vergelijken', 'deel_van_totaal']) {
    const lijst = (gevonden as Record<string, unknown> | null)?.[soort]
    if (!Array.isArray(lijst)) continue
    for (const invoer of lijst.slice(0, MAX_PER_SOORT) as Record<string, unknown>[]) {
      const vreemd = vereist(soort, invoer ?? {}).filter(v => typeof v === 'number' && v !== 0 && !staatErin(v, bekend))
      if (vreemd.length > 0) { afgekeurd.push(`${soort}: ${vreemd.join(', ')} staat niet in de tekst van de gebruiker`); continue }
      const r = voerGeldToolUit(soort, invoer)
      if (!r || r.isError) { afgekeurd.push(`${soort}: ${r?.content ?? 'onbekend'}`); continue }
      uitgevoerd.push(soort)
      uitkomsten.push(`Berekening ${soort}, met als invoer ${JSON.stringify(invoer)}:\n${r.content}`)
    }
  }
  if (uitkomsten.length === 0) return { blok: '', uitgevoerd, afgekeurd }
  const blok = `UITGEREKEND DOOR DE APP VOOR DIT BERICHT\nDe code heeft dit berekend. Klopt de ingevulde invoer met wat de gebruiker zei, gebruik dan deze bedragen met de voorwaarde die erbij staat en reken deze vraag niet zelf opnieuw uit, ook niet met een tool. Rekende een eerder antwoord van jou anders, zeg dat dan in één zin. Klopt de invoer niet, gebruik de uitkomst dan niet. Noem dit blok niet.\n\n${uitkomsten.join('\n\n')}`
  return { blok, uitgevoerd, afgekeurd }
}

/**
 * Wie de geldcontrole, de geldfuncties en het nieuwere model krijgt. Nu alleen de eigenaar (ARNOBOT_OWNER_USER_ID); voor alle anderen
 * werkt de chat zoals hiervoor. Voor iedereen aanzetten: GELDCONTROLE_OPEN=true. Meteen uit, ook voor de eigenaar: GELDCONTROLE_UIT=1.
 */
export function geldBeschikbaarVoor(userId: string | null | undefined): boolean {
  if (!userId || process.env.GELDCONTROLE_UIT === '1') return false
  if (process.env.GELDCONTROLE_OPEN === 'true') return true
  const eigenaar = process.env.ARNOBOT_OWNER_USER_ID
  return !!eigenaar && eigenaar === userId
}

export const GELDCHECK_MODEL = 'claude-haiku-5-5'
// Een herkende geldvraag wordt door dit model beantwoord (met denkstap). Gemeten 27-11: het vorige chatmodel hield de richting van een
// prijswijziging niet vast, ook niet met de juiste uitkomst bij de vraag.
export const GELD_ANTWOORD_MODEL = 'claude-sonnet-5-5'
// Denktokens tellen mee in max_tokens: deze ruimte komt bovenop de lengte van het antwoord, anders kan er geen tekst overblijven.
export const GELD_DENKRUIMTE = 12000

const MAX_BERICHTEN = 12
const MAX_TEKENS_PER_BERICHT = 12000
const TIJDSLIMIET_MS = 10000

type Beurt = { role?: string; content?: unknown }
const tekstVan = (b: Beurt) => (typeof b.content === 'string' ? b.content : '')

// Geen voorfilter op cijfers of geldwoorden (verworpen 27-11): dat hield 3 van de 10 duidelijke geldvragen tegen, bijvoorbeeld
// een klant die iets te duur vindt, terwijl het kleine model alle geldvragen die het wel zag herkende.

/** Het gesprek voor het kleine model; eerdere antwoorden van de coach zijn duidelijk als geen bron gemerkt. */
export function bouwCheckInvoer(historie: Beurt[], vraag: string): string {
  const eerder = historie.slice(-MAX_BERICHTEN)
    .filter(b => tekstVan(b))
    .map(b => `${b.role === 'user' ? 'GEBRUIKER' : 'EERDER ANTWOORD COACH (geen bron)'}:\n${tekstVan(b).slice(0, MAX_TEKENS_PER_BERICHT)}`)
  return [...eerder, `LAATSTE BERICHT VAN DE GEBRUIKER:\n${vraag}`].join('\n\n')
}

export function gebruikersTekst(historie: Beurt[], vraag: string): string {
  return [...historie.filter(b => b.role === 'user').map(tekstVan), vraag].join('\n\n')
}

export type GeldUitkomst = GeldCheck & { geldvraag: boolean }

/**
 * De controle voor een chatbeurt. Gooit bij een fout, een afgekapt of een onleesbaar antwoord: de aanroeper gaat dan verder zonder.
 * opties komt uit aiContext, zodat de aanroep per gebruiker gemeten wordt.
 */
export async function doeGeldCheck(client: Anthropic, historie: Beurt[], vraag: string, opties: Anthropic.RequestOptions): Promise<GeldUitkomst> {
  const res = await client.messages.create({
    model: GELDCHECK_MODEL,
    max_tokens: 6000,
    system: GELDCHECK_SYSTEEM,
    messages: [{ role: 'user', content: bouwCheckInvoer(historie, vraag) }],
    // Met denkstap: zo is de controle gemeten. Zonder denkstap koos het model via de echte API bij een prijsverlaging een verkeerde
    // berekening (27-11). De denktokens tellen mee in max_tokens.
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: GELDCHECK_SCHEMA } },
  }, { ...opties, timeout: TIJDSLIMIET_MS, maxRetries: 0 })
  if (res.stop_reason !== 'end_turn') throw new Error(`geldcontrole stop_reason ${res.stop_reason}`)
  const gevonden = JSON.parse(res.content.map(b => (b.type === 'text' ? b.text : '')).join('')) as { geldvraag?: boolean }
  const check = voerGeldCheckUit(gevonden, gebruikersTekst(historie, vraag))
  return { ...check, geldvraag: gevonden.geldvraag === true || check.blok !== '' }
}

/** Het blok direct bij de vraag, niet achter de lange instructies: zo is het gemeten. */
export function metGeldBlok(inhoud: string | Anthropic.ContentBlockParam[], blok: string): string | Anthropic.ContentBlockParam[] {
  if (!blok) return inhoud
  const tekst = `[Van de app, niet van de gebruiker]\n${blok}`
  return typeof inhoud === 'string' ? `${inhoud}\n\n${tekst}` : [...inhoud, { type: 'text', text: tekst }]
}
