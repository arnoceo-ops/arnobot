import type Anthropic from '@anthropic-ai/sdk'

// Vaste geldsommen voor de hoofdchat (2026-11-27, docs/GELDADVIES_PLAN.md). Zelfde aanleiding als de groeidoeltool:
// de rekentool rekent goed, maar het model geeft de verkeerde som mee. Drie fouten die in echte gesprekken voorkwamen:
// het effect van een prijswijziging, bedragen inclusief en exclusief btw door elkaar, en een eigen cijfer dat al in
// een totaal zit en er nog eens tegenover wordt gezet. Hier kiest de code de som; het model geeft alleen de gegevens.

type Uit = { content: string; isError: boolean }

const bedrag = (n: number) => String(Math.round(n * 100) / 100)
const metTeken = (n: number) => `${Math.round(n * 100) / 100 > 0 ? '+' : ''}${bedrag(n)}`
const getal = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const fout = (content: string): Uit => ({ content, isError: true })

export const PRIJSWIJZIGING_TOOL: Anthropic.Tool = {
  name: 'prijswijziging',
  description:
    'Effect van een wijziging van de eigen verkoopprijs op omzet en marge: prijsverlaging, prijsverhoging, (negatieve) indexering of korting op bestaande omzet. Gebruik dit ALTIJD voor zo\'n vraag in plaats van zelf margepercentage keer bedrag te rekenen met bereken. ' +
    'omzet is de huidige omzet bij de huidige prijs, per periode. Geef wijziging_procent (min bij verlaging) of, als alleen een bedrag bekend is, wijziging_bedrag. marge_procent is de huidige marge als percentage van die omzet; laat weg als die onbekend is. ' +
    'De uitkomst geldt bij gelijke afname. Houd in je antwoord de twee vergelijkingen uit elkaar (tussen de keuzes, en ten opzichte van vandaag) en noem bij elk bedrag de voorwaarde die erbij staat. ' +
    'Schrijf getallen zonder duizendtalpunt en met een punt als decimaalteken.',
  input_schema: {
    type: 'object',
    properties: {
      omzet: { type: 'number', description: 'Huidige omzet bij de huidige prijs, per periode' },
      wijziging_procent: { type: 'number', description: 'Prijswijziging in procenten, min bij verlaging, bijvoorbeeld -8' },
      wijziging_bedrag: { type: 'number', description: 'Alleen zonder percentage: verandering van de omzet in geld, min bij verlaging' },
      marge_procent: { type: 'number', description: 'Optioneel: huidige marge in procenten van de omzet' },
    },
  },
}

export function voerPrijswijzigingUit(input: unknown): Uit {
  const i = (input ?? {}) as Record<string, unknown>
  const omzet = getal(i.omzet)
  const pct = getal(i.wijziging_procent)
  const los = getal(i.wijziging_bedrag)
  const marge = getal(i.marge_procent)
  if ((pct === undefined) === (los === undefined)) return fout('Geef precies een van wijziging_procent of wijziging_bedrag.')
  if (omzet !== undefined && omzet <= 0) return fout('omzet moet groter dan 0 zijn.')
  if (pct !== undefined && omzet === undefined) return fout('Bij wijziging_procent is omzet nodig.')
  if (pct !== undefined && pct <= -100) return fout('wijziging_procent moet groter dan -100 zijn.')
  if (marge !== undefined && (marge > 100 || marge <= -100)) return fout('marge_procent moet tussen -100 en 100 liggen.')
  const delta = pct !== undefined ? (omzet as number) * pct / 100 : (los as number)
  if (delta === 0) return fout('De wijziging is 0.')
  if (omzet !== undefined && omzet + delta <= 0) return fout('De wijziging is minstens zo groot als de omzet.')

  const omlaag = delta < 0
  const naam = omlaag ? 'verlaging' : 'verhoging'
  const groot = bedrag(Math.abs(delta))
  const regels = [
    'Uitgangspunt: de afname blijft gelijk en de bedragen gelden per periode van de opgegeven omzet. Verandert de afname door deze keuze, dan gelden deze uitkomsten niet.',
    `Omzet: ${omzet !== undefined ? `${bedrag(omzet)} wordt ${bedrag(omzet + delta)} (${metTeken(delta)})` : metTeken(delta)}`,
    '',
    `VERGELIJKING 1, wel of niet doorvoeren: de ${naam} doorvoeren ${omlaag ? 'kost' : 'levert'} ${groot} marge ${omlaag ? '' : 'meer op '}vergeleken met niet doorvoeren. Dit geldt ongeacht wat de eigen kosten doen, zolang die niet van deze keuze afhangen. Het is het hele omzetbedrag, niet het margepercentage daarvan.`,
  ]
  regels.push(omlaag
    ? `Richting: doorvoeren is de prijs verlagen (bijvoorbeeld een negatieve index toepassen) en is de keuze die jou ${groot} KOST. Niet doorvoeren (de verlaging overslaan, de huidige prijs houden) HOUDT die ${groot}. "Dat geld niet weggeven" is dus een argument om NIET door te voeren. Wie adviseert door te voeren, adviseert de keuze die geld kost en moet zeggen wat daar tegenover staat.`
    : `Richting: doorvoeren is de prijs verhogen en is de keuze die jou ${groot} OPLEVERT. Niet doorvoeren laat die ${groot} liggen.`)
  if (marge === undefined) {
    regels.push('', 'Marge onbekend: wat er ten opzichte van vandaag met het margepercentage gebeurt is niet te berekenen.')
    return { content: regels.join('\n'), isError: false }
  }
  regels.push('', 'VERGELIJKING 2, ten opzichte van vandaag (dit hangt af van de eigen kosten):')
  const nuMarge = omzet !== undefined ? omzet * marge / 100 : undefined
  const na = (margeBedrag: number, omzetDan: number) => `marge ${bedrag(margeBedrag)}, dat is ${bedrag(margeBedrag / omzetDan * 100)}% van de omzet`
  if (omzet !== undefined && nuMarge !== undefined) regels.push(`Vandaag: ${na(nuMarge, omzet)}.`)
  regels.push(
    `A. Doorvoeren, eigen kosten blijven gelijk: ${metTeken(delta)} marge${omzet !== undefined ? `, ${na((nuMarge as number) + delta, omzet + delta)}` : ''}.`,
  )
  if (pct !== undefined && omzet !== undefined && nuMarge !== undefined) {
    const kosten = omzet - nuMarge
    const kostenDelta = kosten * pct / 100
    regels.push(
      `B. Doorvoeren, ALLE eigen kosten veranderen ook met ${metTeken(pct)}%: ${metTeken(delta * marge / 100)} marge, ${na(nuMarge + delta - kostenDelta, omzet + delta)}.`,
      `C. Niet doorvoeren, eigen kosten blijven gelijk: marge gelijk aan vandaag.`,
      `D. Niet doorvoeren, ALLE eigen kosten veranderen met ${metTeken(pct)}%: ${metTeken(-kostenDelta)} marge, ${na(nuMarge - kostenDelta, omzet)}.`,
      'Verandert maar een deel van de kosten, of met een kleiner percentage, dan ligt de uitkomst van doorvoeren tussen A en B en van niet doorvoeren tussen C en D. Wat de kosten werkelijk doen is hiermee niet bekend.',
    )
  } else {
    regels.push('Zonder percentage en omzet is niet te berekenen wat meebewegende kosten doen.')
  }
  return { content: regels.join('\n'), isError: false }
}

export const PRIJZEN_VERGELIJKEN_TOOL: Anthropic.Tool = {
  name: 'prijzen_vergelijken',
  description:
    'Zet prijzen op dezelfde btw-basis en vergelijkt ze. Gebruik dit ALTIJD zodra je prijzen, bedragen of inkoop en verkoop vergelijkt waarbij minstens een bedrag inclusief of exclusief btw is genoemd, ook voor de vraag of iemand verlies maakt of hoeveel korting nodig is. Vergelijk zulke bedragen nooit met bereken. ' +
    'Geef elk bedrag mee zoals het is genoemd, per dezelfde eenheid, met btw "inclusief", "exclusief" of "onbekend". btw_procent is het tarief dat voor dit product en land geldt; btw_procent_bron is "gebruiker" als de gebruiker het zelf noemde, anders "aanname", en dan noem je het in je antwoord als aanname.',
  input_schema: {
    type: 'object',
    properties: {
      prijzen: {
        type: 'array', minItems: 2, maxItems: 8,
        items: {
          type: 'object',
          properties: {
            naam: { type: 'string' },
            bedrag: { type: 'number' },
            btw: { type: 'string', enum: ['inclusief', 'exclusief', 'onbekend'] },
          },
          required: ['naam', 'bedrag', 'btw'],
        },
      },
      btw_procent: { type: 'number', description: 'Btw-tarief in procenten' },
      btw_procent_bron: { type: 'string', enum: ['gebruiker', 'aanname'] },
    },
    required: ['prijzen', 'btw_procent', 'btw_procent_bron'],
  },
}

export function voerPrijzenVergelijkenUit(input: unknown): Uit {
  const i = (input ?? {}) as Record<string, unknown>
  const tarief = getal(i.btw_procent)
  if (tarief === undefined || tarief < 0 || tarief > 100) return fout('Geef btw_procent tussen 0 en 100.')
  const lijst = Array.isArray(i.prijzen) ? (i.prijzen as Record<string, unknown>[]) : []
  if (lijst.length < 2 || lijst.length > 8) return fout('Geef 2 tot 8 prijzen.')
  const prijzen = lijst.map(p => ({ naam: String(p?.naam ?? '').slice(0, 80), bedrag: getal(p?.bedrag), btw: p?.btw }))
  if (prijzen.some(p => !p.naam || p.bedrag === undefined || p.bedrag <= 0 || !['inclusief', 'exclusief', 'onbekend'].includes(p.btw as string))) {
    return fout('Elke prijs heeft een naam, een bedrag groter dan 0 en btw "inclusief", "exclusief" of "onbekend".')
  }
  const f = 1 + tarief / 100
  const regels = [`Btw-tarief: ${bedrag(tarief)}% (${i.btw_procent_bron === 'gebruiker' ? 'genoemd door de gebruiker' : 'AANNAME, noem dit in je antwoord als aanname'}).`]
  for (const p of prijzen) {
    const b = p.bedrag as number
    if (p.btw === 'onbekend') regels.push(`${p.naam}: ${bedrag(b)}, btw ONBEKEND. Als dit inclusief is: ${bedrag(b / f)} exclusief. Als dit exclusief is: ${bedrag(b)} exclusief.`)
    else {
      const excl = p.btw === 'inclusief' ? b / f : b
      regels.push(`${p.naam}: ${bedrag(excl)} exclusief btw, ${bedrag(excl * f)} inclusief btw (genoemd als ${bedrag(b)} ${p.btw}).`)
    }
  }
  const bekend = prijzen.filter(p => p.btw !== 'onbekend').map(p => ({ naam: p.naam, excl: p.btw === 'inclusief' ? (p.bedrag as number) / f : (p.bedrag as number) }))
  if (bekend.length >= 2) {
    regels.push('', 'Verschillen op dezelfde basis (exclusief btw):')
    for (let a = 0; a < bekend.length; a++) for (let b = a + 1; b < bekend.length; b++) {
      const [x, y] = [bekend[a], bekend[b]]
      if (Math.abs(x.excl - y.excl) < 0.005) { regels.push(`${x.naam} en ${y.naam} zijn gelijk.`); continue }
      const [hoog, laag] = x.excl > y.excl ? [x, y] : [y, x]
      regels.push(`${hoog.naam} is ${bedrag(hoog.excl - laag.excl)} hoger dan ${laag.naam}. Om gelijk te komen moet ${hoog.naam} ${bedrag((1 - laag.excl / hoog.excl) * 100)}% omlaag. Verkoop je voor ${laag.naam} wat je voor ${hoog.naam} inkoopt, dan is dat ${bedrag(hoog.excl - laag.excl)} verlies per stuk voor andere kosten.`)
    }
  }
  if (bekend.length < prijzen.length) regels.push('', 'Zolang van een bedrag niet bekend is of het inclusief of exclusief btw is, staat de vergelijking daarmee niet vast. Noem beide uitkomsten of vraag het.')
  return { content: regels.join('\n'), isError: false }
}

export const DEEL_VAN_TOTAAL_TOOL: Anthropic.Tool = {
  name: 'deel_van_totaal',
  description:
    'Zet de verandering van een deel (een persoon, klant, regio of product) naast die van een totaal (team, bedrijf, portefeuille). Gebruik dit ALTIJD voordat je zegt dat een deel een daling van het totaal goedmaakt, dat het totaal zonder dat deel anders zou zijn, of hoeveel het deel bijdraagt. ' +
    'deel_in_totaal is "ja" als het totaalcijfer dit deel al meetelt (een totaalregel onder een tabel met die rij erin), "nee" als het totaal alleen de anderen is, en "onbekend" als je dat niet kunt zien. ' +
    'periode is "gelijk" als nu en vorig dezelfde periode beslaan, en "lopend_tegen_heel_jaar" als een onafgemaakte periode tegenover een heel jaar staat.',
  input_schema: {
    type: 'object',
    properties: {
      totaal_nu: { type: 'number' }, totaal_vorig: { type: 'number' },
      deel_nu: { type: 'number' }, deel_vorig: { type: 'number' },
      deel_in_totaal: { type: 'string', enum: ['ja', 'nee', 'onbekend'] },
      periode: { type: 'string', enum: ['gelijk', 'lopend_tegen_heel_jaar'] },
    },
    required: ['totaal_nu', 'totaal_vorig', 'deel_nu', 'deel_vorig', 'deel_in_totaal', 'periode'],
  },
}

export function voerDeelVanTotaalUit(input: unknown): Uit {
  const i = (input ?? {}) as Record<string, unknown>
  const [tn, tv, dn, dv] = [i.totaal_nu, i.totaal_vorig, i.deel_nu, i.deel_vorig].map(getal)
  if (tn === undefined || tv === undefined || dn === undefined || dv === undefined) return fout('Geef totaal_nu, totaal_vorig, deel_nu en deel_vorig als getallen.')
  const inTotaal = i.deel_in_totaal
  if (inTotaal !== 'ja' && inTotaal !== 'nee' && inTotaal !== 'onbekend') return fout('deel_in_totaal is "ja", "nee" of "onbekend".')
  const dTotaal = tn - tv
  const dDeel = dn - dv
  const regels = [`Verandering deel: ${metTeken(dDeel)}. Verandering opgegeven totaal: ${metTeken(dTotaal)}.`]
  const alsIn = () => {
    const rest = dTotaal - dDeel
    const r = [`Het deel zit al in het totaal. De anderen samen, dus het totaal zonder dit deel: ${metTeken(rest)}. Met dit deel erbij: ${metTeken(dTotaal)}.`]
    if (dDeel > 0 && rest < 0) {
      r.push(dTotaal >= 0
        ? `Het deel maakt de daling van de anderen (${bedrag(-rest)}) helemaal goed en houdt ${bedrag(dTotaal)} over.`
        : `Het deel maakt ${bedrag(dDeel)} van de daling van de anderen (${bedrag(-rest)}) goed, niet alles: het totaal daalt nog ${bedrag(-dTotaal)}. Zeg NIET dat dit deel het verlies van het totaal compenseert of er bovenop groeit; het zit al in het cijfer ${metTeken(dTotaal)}.`)
    }
    return r
  }
  const alsLos = () => {
    const som = dTotaal + dDeel
    return [`Het totaal is zonder dit deel. Samen met dit deel: ${metTeken(som)}.`]
  }
  if (inTotaal === 'ja') regels.push(...alsIn())
  else if (inTotaal === 'nee') regels.push(...alsLos())
  else regels.push('ONBEKEND of het deel in het totaal zit. Trek geen conclusie over goedmaken; vraag het, of noem beide.', 'Als het erin zit:', ...alsIn(), 'Als het er niet in zit:', ...alsLos())
  if (i.periode === 'lopend_tegen_heel_jaar') regels.push('Let op: een onafgemaakte periode staat tegenover een heel jaar. Een lager bedrag is nog geen daling of verlies; noem het de stand tot nu toe tegenover heel vorig jaar.')
  regels.push('Deze uitkomst zegt niets over wie het meest groeit of de enige is die groeit; daarvoor zijn alle rijen nodig.')
  return { content: regels.join('\n'), isError: false }
}

export const CHAT_GELDTOOLS: Anthropic.Tool[] = [PRIJSWIJZIGING_TOOL, PRIJZEN_VERGELIJKEN_TOOL, DEEL_VAN_TOTAAL_TOOL]

export function voerGeldToolUit(naam: string, input: unknown): Uit | null {
  if (naam === 'prijswijziging') return voerPrijswijzigingUit(input)
  if (naam === 'prijzen_vergelijken') return voerPrijzenVergelijkenUit(input)
  if (naam === 'deel_van_totaal') return voerDeelVanTotaalUit(input)
  return null
}
