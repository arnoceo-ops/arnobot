import type Anthropic from '@anthropic-ai/sdk'

// Tabeltool voor de hoofdchat (2026-11-19). Aanleiding: bij een dashboard-screenshot las ArnoBot de tabel goed af
// (stap 0: 10 van 10 keer foutloos overgeschreven), maar maakte fouten bij het kiezen van een kolom en het
// vergelijken van rijen: "grootste daler" terwijl dat een ander was, en "groeit samen met X en Y" terwijl dat
// alleen in de YTD-kolom klopte. Daarom: het model schrijft de tabel één keer over (lezen), en rangorde, filters,
// aandelen en groei worden door de server berekend (kiezen en vergelijken). Het model moet een exacte kolomnaam
// uit de overgeschreven tabel opgeven, vrije tekst wordt geweigerd.
//
// Bewust niet bewaard tussen beurten: de bijlage gaat elke beurt mee en overschrijven gaat betrouwbaar, dus geen
// opslag, geen kans dat een fout in een cache blijft hangen. De tabel leeft alleen in dit verzoek.

export type Tabel = {
  kolommen: string[]
  rijen: { label: string; waarden: (number | null)[] }[]
  totaal: (number | null)[] | null
}
export type TabelStaat = { tabel: Tabel | null }
export const maakTabelStaat = (): TabelStaat => ({ tabel: null })

const MAX_RIJEN = 200
const MAX_KOLOMMEN = 20
const MARGE = 2 // dashboards ronden af: een verschil van 1 of 2 in een Δ-kolom is normaal

export const SCHRIJF_TABEL_OVER_TOOL: Anthropic.Tool = {
  name: 'schrijf_tabel_over',
  description:
    'Schrijf een tabel uit een bijlage (afbeelding, PDF) of uit de tekst exact over, voordat je er iets over zegt. Verplicht zodra een vraag over een tabel gaat: wie het meest of minst heeft, wie groeit of daalt, aandelen, vergelijkingen tussen rijen of kolommen. ' +
    'Elke rij: label (de naam in de eerste kolom, leeg laten als er geen staat) en per kolom een getal zonder duizendtalpunt en met een punt als decimaalteken (negatief met een minteken), of null als de cel leeg is. ' +
    'Een Totaal-rij hoort niet bij rijen maar in totaal. Neem de kolomkoppen letterlijk over. Sla geen rij of kolom over. Noem na het overschrijven nooit namen van andere rijen als groeier, daler, grootste, kleinste of "de enige die", en zeg niets over hoeveel rijen iets doen, zonder dat tabel_vraag het heeft uitgerekend. Na het overschrijven krijg je een controle terug: lees een gemelde afwijking opnieuw in de afbeelding en schrijf de tabel opnieuw over als je je vergist hebt. Kondig het overschrijven of controleren nooit aan: roep de tool aan zonder tekst ervoor, en begin je antwoord pas bij het antwoord. Blijft een afwijking staan na opnieuw lezen, noem die dan alleen als ze de getallen raakt waar de gebruiker naar vraagt, en stel niet vast of het aan het dashboard ligt.',
  input_schema: {
    type: 'object',
    properties: {
      kolommen: { type: 'array', items: { type: 'string' }, description: 'De kolomkoppen letterlijk, zonder de kolom met namen' },
      rijen: {
        type: 'array',
        items: {
          type: 'object',
          properties: { label: { type: 'string' }, waarden: { type: 'array', items: { type: ['number', 'null'] } } },
          required: ['label', 'waarden'],
        },
      },
      totaal: { type: ['array', 'null'], items: { type: ['number', 'null'] }, description: 'De Totaal-rij als die er is, anders null' },
    },
    required: ['kolommen', 'rijen'],
  },
}

export const TABEL_VRAAG_TOOL: Anthropic.Tool = {
  name: 'tabel_vraag',
  description:
    'Beantwoordt een vraag over de tabel die je met schrijf_tabel_over hebt overgeschreven. Reken, sorteer en vergelijk nooit zelf over rijen: gebruik deze tool. ' +
    'bewerking: "rangorde" (de hoogste of laagste rijen in een kolom, met richting "hoogste" of "laagste" en aantal), "filter" (alle rijen met een positieve of negatieve waarde in een kolom, met teken "positief" of "negatief"), ' +
    '"waarde" (een cel: rij en kolom), "aandeel" (waarde van een rij als deel van het totaal van die kolom), "groei" (rij, kolom is het nieuwe getal, kolom_b het oude: verschil en procent). ' +
    'kolom moet EXACT een kolomkop uit de tabel zijn, anders weigert de tool. Hoort een vraag niet bij een bepaalde kolom (bijvoorbeeld "wie daalt", terwijl er een kolom voor het hele jaar en een voor YTD is), roep de tool dan voor elke passende kolom aan, geef beide uitkomsten en zeg welke kolom welke is. ' +
    'Noem in je antwoord altijd de kolom waarop elke uitkomst gebaseerd is.',
  input_schema: {
    type: 'object',
    properties: {
      bewerking: { type: 'string', enum: ['rangorde', 'filter', 'waarde', 'aandeel', 'groei'] },
      kolom: { type: 'string', description: 'Exacte kolomkop' },
      kolom_b: { type: 'string', description: 'Alleen bij groei: exacte kolomkop van het oude getal' },
      rij: { type: 'string', description: 'Label van de rij (bij waarde, aandeel, groei)' },
      richting: { type: 'string', enum: ['hoogste', 'laagste'] },
      aantal: { type: 'number', description: 'Aantal rijen bij rangorde, standaard 3' },
      teken: { type: 'string', enum: ['positief', 'negatief'] },
    },
    required: ['bewerking', 'kolom'],
  },
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
const getal = (n: number) => String(Number(n.toPrecision(12)))
const naam = (l: string) => (l.trim() === '' ? '(zonder naam)' : l)

function isGetalOfNull(v: unknown): v is number | null {
  return v === null || (typeof v === 'number' && Number.isFinite(v))
}

/** Kruiscontrole: een Δ-kolom hoort het verschil van twee andere kolommen te zijn. Meldt rijen die afwijken. */
export function kruisControle(t: Tabel): string[] {
  const deltaKol = t.kolommen.map((k, i) => (/^\s*(Δ|delta|verschil)/i.test(k) ? i : -1)).filter(i => i >= 0)
  const meldingen: string[] = []
  for (const d of deltaKol) {
    const overig = t.kolommen.map((_, i) => i).filter(i => i !== d && !deltaKol.includes(i))
    let beste: { a: number; b: number; goed: number; totaal: number } | null = null
    for (const a of overig) {
      for (const b of overig) {
        if (a === b) continue
        let goed = 0
        let totaal = 0
        for (const r of t.rijen) {
          const x = r.waarden[a]; const y = r.waarden[b]; const z = r.waarden[d]
          if (x == null || y == null || z == null) continue
          totaal++
          if (Math.abs(x - y - z) <= MARGE) goed++
        }
        if (totaal >= 3 && (!beste || goed > beste.goed)) beste = { a, b, goed, totaal }
      }
    }
    if (!beste || beste.goed / beste.totaal < 0.7) continue
    for (const r of t.rijen) {
      const x = r.waarden[beste.a]; const y = r.waarden[beste.b]; const z = r.waarden[d]
      if (x == null || y == null || z == null) continue
      if (Math.abs(x - y - z) > MARGE) {
        meldingen.push(`rij "${naam(r.label)}": ${t.kolommen[beste.a]} (${getal(x)}) min ${t.kolommen[beste.b]} (${getal(y)}) is ${getal(x - y)}, maar ${t.kolommen[d]} staat op ${getal(z)}`)
      }
    }
  }
  return meldingen
}

export function voerSchrijfTabelOverUit(input: unknown, staat: TabelStaat): { content: string; isError: boolean } {
  const i = (input ?? {}) as Record<string, unknown>
  const kolommen = i.kolommen
  const rijen = i.rijen
  if (!Array.isArray(kolommen) || kolommen.length === 0 || kolommen.length > MAX_KOLOMMEN || !kolommen.every(k => typeof k === 'string' && k.trim() !== '')) {
    return { content: 'kolommen moet een lijst met kolomkoppen zijn (tekst, niet leeg).', isError: true }
  }
  if (new Set(kolommen.map(k => norm(k as string))).size !== kolommen.length) {
    return { content: 'Twee kolommen hebben dezelfde kop. Maak ze uniek (bijvoorbeeld met de groep ervoor) en schrijf opnieuw over.', isError: true }
  }
  if (!Array.isArray(rijen) || rijen.length === 0 || rijen.length > MAX_RIJEN) {
    return { content: 'rijen moet een lijst zijn met minstens één rij.', isError: true }
  }
  const schoon: Tabel['rijen'] = []
  for (const r of rijen) {
    const o = r as { label?: unknown; waarden?: unknown }
    if (typeof o?.label !== 'string' || !Array.isArray(o.waarden) || o.waarden.length !== kolommen.length || !o.waarden.every(isGetalOfNull)) {
      return { content: `Elke rij heeft een label en precies ${kolommen.length} waarden (getal of null). Controleer rij "${typeof o?.label === 'string' ? o.label : '?'}".`, isError: true }
    }
    schoon.push({ label: o.label, waarden: o.waarden as (number | null)[] })
  }
  let totaal: (number | null)[] | null = null
  if (Array.isArray(i.totaal)) {
    if (i.totaal.length !== kolommen.length || !i.totaal.every(isGetalOfNull)) {
      return { content: `totaal heeft precies ${kolommen.length} waarden (getal of null), of laat het weg.`, isError: true }
    }
    totaal = i.totaal as (number | null)[]
  }
  const tabel: Tabel = { kolommen: kolommen as string[], rijen: schoon, totaal }
  staat.tabel = tabel
  const afwijkingen = kruisControle(tabel)
  const regels = [`Tabel opgeslagen: ${schoon.length} rijen, kolommen: ${tabel.kolommen.map(k => `"${k}"`).join(', ')}.`]
  if (afwijkingen.length > 0) {
    regels.push('KRUISCONTROLE, mogelijk verkeerd overgeschreven (lees deze cellen opnieuw in de afbeelding en schrijf zo nodig opnieuw over). Dit is een interne controle: schrijf er niets over in je antwoord, tenzij een cel die blijft afwijken de getallen raakt waar de gebruiker naar vraagt:', ...afwijkingen)
  } else {
    regels.push('Kruiscontrole van de verschilkolommen: geen afwijkingen.')
  }
  return { content: regels.join('\n'), isError: false }
}

function zoekKolom(t: Tabel, gevraagd: unknown): { idx: number } | { fout: string } {
  const geldig = t.kolommen.map(k => `"${k}"`).join(', ')
  if (typeof gevraagd !== 'string' || gevraagd.trim() === '') return { fout: `Geef een kolom op. Geldig: ${geldig}.` }
  const idx = t.kolommen.findIndex(k => norm(k) === norm(gevraagd))
  if (idx < 0) return { fout: `Kolom "${gevraagd.slice(0, 60)}" bestaat niet. Gebruik exact een van: ${geldig}.` }
  return { idx }
}

function zoekRij(t: Tabel, gevraagd: unknown): { idx: number } | { fout: string } {
  const lijst = t.rijen.map(r => `"${naam(r.label)}"`).join(', ')
  if (typeof gevraagd !== 'string' || gevraagd.trim() === '') return { fout: `Geef een rij op. Geldig: ${lijst}.` }
  const exact = t.rijen.findIndex(r => norm(r.label) === norm(gevraagd))
  if (exact >= 0) return { idx: exact }
  const deel = t.rijen.map((r, i) => (norm(r.label).includes(norm(gevraagd)) ? i : -1)).filter(i => i >= 0)
  if (deel.length === 1) return { idx: deel[0] }
  return { fout: `Rij "${gevraagd.slice(0, 60)}" niet eenduidig gevonden. Gebruik exact een van: ${lijst}.` }
}

export function voerTabelVraagUit(input: unknown, staat: TabelStaat): { content: string; isError: boolean } {
  const t = staat.tabel
  if (!t) return { content: 'Er is nog geen tabel overgeschreven. Gebruik eerst schrijf_tabel_over.', isError: true }
  const i = (input ?? {}) as Record<string, unknown>
  const k = zoekKolom(t, i.kolom)
  if ('fout' in k) return { content: k.fout, isError: true }
  const kolomNaam = t.kolommen[k.idx]
  const bewerking = i.bewerking

  if (bewerking === 'rangorde') {
    const richting = i.richting === 'laagste' ? 'laagste' : 'hoogste'
    const aantal = Math.min(Math.max(1, Math.floor(Number(i.aantal) || 3)), 25)
    const metWaarde = t.rijen.filter(r => r.waarden[k.idx] !== null)
    const gesorteerd = [...metWaarde].sort((a, b) => (richting === 'hoogste' ? (b.waarden[k.idx] as number) - (a.waarden[k.idx] as number) : (a.waarden[k.idx] as number) - (b.waarden[k.idx] as number)))
    const top = gesorteerd.slice(0, aantal)
    return {
      content: `Kolom "${kolomNaam}", ${richting} ${top.length} van ${metWaarde.length} rijen met een waarde (Totaal-rij niet meegeteld):\n` +
        top.map((r, n) => `${n + 1}. ${naam(r.label)}: ${getal(r.waarden[k.idx] as number)}`).join('\n'),
      isError: false,
    }
  }

  if (bewerking === 'filter') {
    if (i.teken !== 'positief' && i.teken !== 'negatief') return { content: 'Geef teken op: "positief" of "negatief".', isError: true }
    const pos = i.teken === 'positief'
    const gevonden = t.rijen.filter(r => { const v = r.waarden[k.idx]; return v !== null && (pos ? v > 0 : v < 0) })
    const zonder = t.rijen.filter(r => r.waarden[k.idx] === null).length
    return {
      content: `Kolom "${kolomNaam}", ${i.teken}: ${gevonden.length} van ${t.rijen.length} rijen${zonder ? ` (${zonder} zonder waarde niet meegeteld)` : ''}:\n` +
        (gevonden.length ? gevonden.map(r => `${naam(r.label)}: ${getal(r.waarden[k.idx] as number)}`).join('\n') : '(geen)'),
      isError: false,
    }
  }

  const r = zoekRij(t, i.rij)
  if ('fout' in r) return { content: r.fout, isError: true }
  const rij = t.rijen[r.idx]
  const w = rij.waarden[k.idx]

  if (bewerking === 'waarde') {
    return { content: `${naam(rij.label)}, kolom "${kolomNaam}": ${w === null ? 'leeg' : getal(w)}`, isError: false }
  }

  if (bewerking === 'aandeel') {
    const tot = t.totaal?.[k.idx]
    if (w === null || tot == null || tot === 0) return { content: `Geen waarde of geen totaal voor kolom "${kolomNaam}".`, isError: true }
    return { content: `${naam(rij.label)}, kolom "${kolomNaam}": ${getal(w)} van totaal ${getal(tot)} = ${getal(Number(((w / tot) * 100).toFixed(2)))}%`, isError: false }
  }

  if (bewerking === 'groei') {
    const b = zoekKolom(t, i.kolom_b)
    if ('fout' in b) return { content: `kolom_b: ${b.fout}`, isError: true }
    const oud = rij.waarden[b.idx]
    if (w === null || oud === null || oud === 0) return { content: 'Een van beide kolommen is leeg of nul voor deze rij.', isError: true }
    return {
      content: `${naam(rij.label)}: "${kolomNaam}" ${getal(w)} tegenover "${t.kolommen[b.idx]}" ${getal(oud)}: verschil ${getal(w - oud)}, ${getal(Number((((w - oud) / oud) * 100).toFixed(2)))}%`,
      isError: false,
    }
  }

  return { content: 'Onbekende bewerking. Kies uit rangorde, filter, waarde, aandeel, groei.', isError: true }
}
