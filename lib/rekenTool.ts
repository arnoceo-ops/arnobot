import type Anthropic from '@anthropic-ai/sdk'
import { SCHRIJF_TABEL_OVER_TOOL, TABEL_VRAAG_TOOL, voerSchrijfTabelOverUit, voerTabelVraagUit, maakTabelStaat, type TabelStaat } from './tabelTool'
import { CHAT_GELDTOOLS, voerGeldToolUit } from './geldTool'

// Exacte rekenmachine voor de hoofdchat (2026-11-01). Aanleiding: ArnoBot schreef "115 m2 tegen 90 euro
// = 12.420" (moet 10.350 zijn) en herhaalde bij de correctie een tweede foute som. Een taalmodel rekent
// niet, het schat het meest waarschijnlijke getal. Daarom rekent een tool, het model schrijft alleen op
// wat de tool teruggeeft. Bewust een eigen parser en geen eval/Function: de invoer komt van een model
// dat tekst van gebruikers leest.

const MAX_EXPRESSIES = 20
const MAX_LENGTE = 200

type Token = { t: 'num'; v: number } | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' | '(' | ')' }

function tokeniseer(invoer: string): Token[] {
  const s = invoer.replace(/[×x]/gi, '*').replace(/\s+/g, '')
  const tokens: Token[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      const tekst = s.slice(i, j)
      if (!/^\d+(\.\d+)?$/.test(tekst)) throw new Error(`ongeldig getal "${tekst}"`)
      tokens.push({ t: 'num', v: Number(tekst) })
      i = j
    } else if ('+-*/^()'.includes(c)) {
      tokens.push({ t: 'op', v: c as '+' | '-' | '*' | '/' | '^' | '(' | ')' })
      i++
    } else {
      throw new Error(`ongeldig teken "${c}"`)
    }
  }
  if (tokens.length === 0) throw new Error('lege berekening')
  return tokens
}

export function bereken(expressie: string): number {
  if (expressie.length > MAX_LENGTE) throw new Error('berekening te lang')
  const tokens = tokeniseer(expressie)
  let pos = 0
  const kijk = () => tokens[pos]
  const isOp = (v: string) => { const t = kijk(); return t?.t === 'op' && t.v === v }

  function expr(): number {
    let links = term()
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { v: string }).v
      const rechts = term()
      links = op === '+' ? links + rechts : links - rechts
    }
    return links
  }
  function term(): number {
    let links = macht()
    while (isOp('*') || isOp('/')) {
      const op = (tokens[pos++] as { v: string }).v
      const rechts = macht()
      if (op === '/' && rechts === 0) throw new Error('delen door nul')
      links = op === '*' ? links * rechts : links / rechts
    }
    return links
  }
  function macht(): number {
    const basis = eenvoud()
    if (isOp('^')) { pos++; return Math.pow(basis, macht()) }
    return basis
  }
  function eenvoud(): number {
    if (isOp('-')) { pos++; return -eenvoud() }
    if (isOp('+')) { pos++; return eenvoud() }
    const t = kijk()
    if (!t) throw new Error('onvolledige berekening')
    if (t.t === 'num') { pos++; return t.v }
    if (isOp('(')) {
      pos++
      const w = expr()
      if (!isOp(')')) throw new Error('haakje niet gesloten')
      pos++
      return w
    }
    throw new Error('onverwacht teken')
  }

  const uitkomst = expr()
  if (pos < tokens.length) throw new Error('onverwacht teken')
  if (!Number.isFinite(uitkomst)) throw new Error('uitkomst is geen eindig getal')
  return Number(uitkomst.toPrecision(12))
}

export const REKEN_TOOL: Anthropic.Tool = {
  name: 'bereken',
  description:
    'Exacte rekenmachine. Gebruik deze voor ELKE berekening met getallen: vermenigvuldigen, optellen, percentages, totalen, verhoudingen, gemiddelden, ook voor een tussenstap. ' +
    'Reken nooit zelf uit het hoofd en schrijf nooit een uitkomst op die je niet van deze tool kreeg. Geef alle berekeningen die je nodig hebt tegelijk mee. ' +
    'Schrijf getallen met een punt als decimaalteken en zonder duizendtalpunt (0.75 of 10350), gebruik de tekens + * / en het minteken, en haakjes. ' +
    'Staan de getallen in een tabel met meerdere kolommen (heel jaar, tot nu toe, YTD), noem in je antwoord altijd welke kolom je gebruikte. Een groeidoel op vorig jaar reken je met de tool groeidoel. ' +
    'NIET met deze tool: het effect van een prijsverlaging, prijsverhoging of indexering op omzet of marge (gebruik prijswijziging), prijzen vergelijken waarbij inclusief of exclusief btw speelt (gebruik prijzen_vergelijken) en een eigen cijfer naast een team- of totaalcijfer (gebruik deel_van_totaal). ' +
    'Een korting van 25% op 120 is 120 * 0.75. Een jaarbedrag van 115 m2 tegen 90 euro per m2 is 115 * 90.',
  input_schema: {
    type: 'object',
    properties: {
      expressies: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: MAX_EXPRESSIES,
        description: 'De berekeningen, bijvoorbeeld ["115 * 90", "61 * 90", "(115 * 120) + (61 * 90)"]',
      },
    },
    required: ['expressies'],
  },
}

// Groeidoel (2026-11-19). Aanleiding: ArnoBot gebruikte voor "10% groei op vorig jaar" de huidige stand
// als basis (2.271.804 x 1,1 i.p.v. 2.146.660 x 1,1) en noemde "nog 147.180 over" terwijl het 89.522 was.
// De rekentool rekende goed, het model gaf de verkeerde basis mee. Deze tool neemt alleen de twee omzetten
// en het percentage, zodat de basis niet meer kan verwisselen: het doel is altijd vorig_jaar x (1 + p/100).
export const GROEIDOEL_TOOL: Anthropic.Tool = {
  name: 'groeidoel',
  description:
    'Groeidoel op basis van vorig jaar. Gebruik dit ALTIJD als iemand een groeipercentage wil halen ("ik wil 10% groei", "hoe ver ben ik van mijn doel"), in plaats van zelf te rekenen met bereken. ' +
    'vorig_jaar is de basis waarop het percentage geldt: bij een jaardoel de omzet van HEEL vorig jaar, nooit de huidige stand. nu is de omzet tot nu toe dit jaar. ' +
    'Staan in een tabel meerdere kolommen (heel vorig jaar, vorig jaar tot dezelfde datum, YTD), kies dan de kolom die bij de vraag hoort en noem in je antwoord altijd welke kolom je gebruikte. ' +
    'Is onduidelijk welke je moet nemen, geef beide uitkomsten en zeg welke welke is. Schrijf getallen zonder duizendtalpunt en met een punt als decimaalteken.',
  input_schema: {
    type: 'object',
    properties: {
      vorig_jaar: { type: 'number', description: 'Omzet van de basisperiode van vorig jaar, bijvoorbeeld 2146660' },
      nu: { type: 'number', description: 'Omzet tot nu toe dit jaar, bijvoorbeeld 2271804' },
      percentage: { type: 'number', description: 'Gewenste groei in procenten, bijvoorbeeld 10' },
      erbij: { type: 'number', description: 'Optioneel: verwachte extra omzet (bevestigde of verwachte orders) die nog bij nu komt' },
    },
    required: ['vorig_jaar', 'nu', 'percentage'],
  },
}

const euro = (n: number) => String(Number(n.toPrecision(12)))

export function voerGroeidoelUit(input: unknown): { content: string; isError: boolean } {
  const i = (input ?? {}) as Record<string, unknown>
  const vorig = Number(i.vorig_jaar)
  const nu = Number(i.nu)
  const p = Number(i.percentage)
  const erbij = i.erbij === undefined || i.erbij === null ? 0 : Number(i.erbij)
  if (![vorig, nu, p, erbij].every(Number.isFinite) || vorig <= 0 || nu < 0) {
    return { content: 'Geef vorig_jaar (groter dan 0), nu en percentage als getallen mee.', isError: true }
  }
  const doel = vorig * (1 + p / 100)
  const verschil = nu - vorig
  const regels = [
    `Doel (${p}% groei op vorig_jaar ${euro(vorig)}): ${euro(vorig)} * ${euro(1 + p / 100)} = ${euro(doel)}`,
    `Stand nu: ${euro(nu)}, dat is ${verschil >= 0 ? '+' : ''}${euro(verschil)} (${euro(Number(((verschil / vorig) * 100).toFixed(2)))}%) ten opzichte van vorig_jaar`,
    `Tekort tot het doel: ${euro(Math.max(0, doel - nu))}${nu >= doel ? ' (doel al gehaald)' : ''}`,
  ]
  if (erbij !== 0) {
    const straks = nu + erbij
    regels.push(`Met ${euro(erbij)} erbij: ${euro(straks)}, dat is ${straks >= doel ? euro(straks - doel) + ' boven' : euro(doel - straks) + ' onder'} het doel (${euro(Number((((straks - vorig) / vorig) * 100).toFixed(2)))}% groei)`)
  }
  return { content: regels.join('\n'), isError: false }
}

// Alle tools van de hoofdchat voor getallen, en de uitvoering per naam (gebruikt door app/api/chat/route.ts
// en scripts/eval-cijfers.ts, zodat de meetset precies dezelfde tools gebruikt als productie).
export const CHAT_REKENTOOLS: Anthropic.Tool[] = [REKEN_TOOL, GROEIDOEL_TOOL, ...CHAT_GELDTOOLS, SCHRIJF_TABEL_OVER_TOOL, TABEL_VRAAG_TOOL]

// De tabelstaat leeft per verzoek (lib/tabelTool.ts): een nieuwe per chatverzoek, niet bewaard.
export function voerToolUit(naam: string, input: unknown, staat: TabelStaat = maakTabelStaat()): { content: string; isError: boolean } {
  if (naam === 'bereken') return voerRekenToolUit(input)
  if (naam === 'groeidoel') return voerGroeidoelUit(input)
  if (naam === 'schrijf_tabel_over') return voerSchrijfTabelOverUit(input, staat)
  if (naam === 'tabel_vraag') return voerTabelVraagUit(input, staat)
  return voerGeldToolUit(naam, input) ?? { content: 'Onbekende tool.', isError: true }
}

export function voerRekenToolUit(input: unknown): { content: string; isError: boolean } {
  const lijst = (input as { expressies?: unknown } | null)?.expressies
  if (!Array.isArray(lijst) || lijst.length === 0) return { content: 'Geef expressies mee als lijst met teksten.', isError: true }
  let fout = false
  const regels = lijst.slice(0, MAX_EXPRESSIES).map(e => {
    if (typeof e !== 'string') { fout = true; return 'ongeldige expressie' }
    try {
      return `${e} = ${bereken(e)}`
    } catch (err) {
      fout = true
      return `${e.slice(0, 80)} = FOUT (${err instanceof Error ? err.message : 'onbekend'})`
    }
  })
  return { content: regels.join('\n'), isError: fout }
}
