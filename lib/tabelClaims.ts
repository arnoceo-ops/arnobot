import type { Tabel } from '@/lib/tabelTool'

// Superlatieven over een tabel ("de hoogste marge van het team", "de grootste daler") controleren tegen de tabel die de server
// al heeft (2026-11-24). Aanleiding: ArnoBot zei in het gesprek van Jessica een paar dagen lang "hoogste marge van het team" terwijl
// een ander op 47,2% stond tegen haar 47,0%. Een gebruiker die zo'n bewering herhaalt tegenover haar manager verliest vertrouwen
// in ArnoBot zodra die het weerlegt. Twee lagen, beide zonder modelaanroep:
//   1. rangordeTekst: de server rekent per kolom de rangorde uit en geeft die mee in het resultaat van schrijf_tabel_over, zodat het
//      model de feiten heeft vóór het "hoogste" of "enige" zegt.
//   2. vindOnjuisteSuperlatieven: na afloop van de beurt, op het getoonde antwoord. Alleen een bewering die we aan een kolom en een
//      rij kunnen koppelen (kolomwoord plus een getal dat in die kolom bij precies één rij staat) en die aantoonbaar niet klopt, wordt
//      gemeld. Twijfel is geen melding. Het resultaat gaat naar het verbruik van de beurt en naar de dagelijkse feitencontrole.
// Bewust niet bewaard: namen en waarden uit de tabel (gegevens van de gebruiker). Een melding bevat alleen de zin uit het antwoord,
// de kolomkop, de plek van de genoemde rij en de waarde bovenaan.

export type TabelClaim = { zin: string; kolom: string; plek: number; van: number; topWaarde: number }

const HOOG = '(hoogste|grootste|beste|meeste|sterkste)'
const LAAG = '(laagste|kleinste|slechtste|minste|zwakste)'
const SUPERLATIEF = new RegExp(`\\b(de|het)\\s+(${HOOG}|${LAAG})\\b`, 'i')
const HOOG_RE = new RegExp(`\\b${HOOG}\\b`, 'i')

// Welk kolomwoord hoort bij welk woord in de zin. Alleen kolommen waarvan de kop dat woord echt bevat tellen.
const KOLOMWOORDEN: { zin: RegExp; kop: RegExp }[] = [
  { zin: /\bmarge/i, kop: /marg/i },
  { zin: /\b(omzet|revenue)/i, kop: /omzet|revenue|this year|dit jaar/i },
  { zin: /\bgroei/i, kop: /^\s*(Δ|delta|verschil|groei)/i },
]

function getallenIn(tekst: string): { waarde: number; decimalen: number; k: boolean }[] {
  const uit: { waarde: number; decimalen: number; k: boolean }[] = []
  for (const m of tekst.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(%|k\b)?/gi)) {
    const heel = m[1].replace(/\./g, '')
    const waarde = Number(`${heel}${m[2] ? `.${m[2]}` : ''}`)
    if (!Number.isFinite(waarde)) continue
    uit.push({ waarde, decimalen: m[2]?.length ?? 0, k: (m[3] ?? '').toLowerCase() === 'k' })
  }
  return uit
}

function komtOvereen(cel: number, g: { waarde: number; decimalen: number; k: boolean }): boolean {
  if (g.k) return Math.abs(cel - g.waarde * 1000) <= Math.max(500, Math.abs(g.waarde * 1000) * 0.005)
  const marge = g.decimalen > 0 ? 0.5 * 10 ** -g.decimalen + 1e-9 : 0.5 + 1e-9
  // Een percentage in een tabel staat als 47 of als 0.47; zoek beide.
  return Math.abs(cel - g.waarde) <= marge || (g.waarde > 1 && Math.abs(cel * 100 - g.waarde) <= marge)
}

export function vindOnjuisteSuperlatieven(antwoord: string, tabel: Tabel): TabelClaim[] {
  const claims: TabelClaim[] = []
  // Zinnen binnen een alinea, met de zin ervoor als steun voor het getal ("Bruto marge 47,0%. Hoogste van het team.").
  const zinnen = antwoord.split(/(?<=[.!?])\s+|\n+/).map(z => z.trim()).filter(Boolean)
  zinnen.forEach((zin, n) => {
    const plat = zin.replace(/\*+/g, '')
    const sup = plat.match(SUPERLATIEF)
    if (!sup) return
    const hoogste = HOOG_RE.test(sup[0])
    const kolomwoord = KOLOMWOORDEN.find(k => k.zin.test(plat))
    if (!kolomwoord) return
    const kolommen = tabel.kolommen.map((k, i) => ({ k, i })).filter(({ k }) => kolomwoord.kop.test(k))
    if (kolommen.length === 0) return
    const getallen = [...getallenIn(plat), ...getallenIn((zinnen[n - 1] ?? '').replace(/\*+/g, ''))]
    if (getallen.length === 0) return

    for (const { k, i } of kolommen) {
      const waarden = tabel.rijen.map(r => r.waarden[i]).filter((w): w is number => w !== null)
      if (waarden.length < 3) continue
      for (const g of getallen) {
        const treffers = waarden.filter(w => komtOvereen(w, g))
        // Koppelen aan één rij: een getal dat bij meerdere rijen staat is geen aanwijzing wie er bedoeld wordt.
        if (treffers.length !== 1) continue
        const genoemd = treffers[0]
        const beter = waarden.filter(w => (hoogste ? w > genoemd : w < genoemd))
        if (beter.length === 0) continue
        const top = hoogste ? Math.max(...waarden) : Math.min(...waarden)
        claims.push({ zin: plat.slice(0, 200), kolom: k, plek: beter.length + 1, van: waarden.length, topWaarde: top })
        return
      }
    }
  })
  return claims
}

const getal = (n: number) => String(Number(n.toPrecision(12)))

/** Rangorde per kolom (top 3 en laagste), door de server berekend, als feitenlijst voor het model na het overschrijven. */
export function rangordeTekst(t: Tabel): string {
  const regels: string[] = []
  t.kolommen.forEach((k, i) => {
    const rijen = t.rijen.filter(r => r.waarden[i] !== null)
    if (rijen.length < 2) return
    const gesorteerd = [...rijen].sort((a, b) => (b.waarden[i] as number) - (a.waarden[i] as number))
    const top = gesorteerd.slice(0, 3).map(r => `${r.label.trim() || '(zonder naam)'} ${getal(r.waarden[i] as number)}`).join(', ')
    const laagste = gesorteerd[gesorteerd.length - 1]
    regels.push(`"${k}": hoogste ${top}; laagste ${laagste.label.trim() || '(zonder naam)'} ${getal(laagste.waarden[i] as number)}`)
  })
  if (regels.length === 0) return ''
  return [
    'RANGORDE PER KOLOM (door de server berekend, Totaal-rij niet meegeteld). Dit is de enige bron voor "de hoogste", "de laagste", "de enige" en "het meest". Noem zo\'n bewering alleen als ze hieruit volgt; staat iemand anders hoger, ook al is het verschil klein, zeg dan "een van de hoogste" of noem wie er boven staat. Dit is een interne lijst: schrijf er niet over dat je hem hebt gekregen.',
    ...regels,
  ].join('\n')
}

