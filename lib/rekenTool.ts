import type Anthropic from '@anthropic-ai/sdk'

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
