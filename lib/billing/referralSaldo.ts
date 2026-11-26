// Wat er van elke toekenning over is, en wat een aanbrenger kan verrekenen: puur rekenwerk op grootboekregels.
// De databasefuncties in docs/sql/2026-11-26-referral-verrekening.sql rekenen precies zo, binnen een slot per
// aanbrenger. Daar valt de echte beslissing; dit bestand is voor tonen en voor de tests.

export interface SaldoRegel {
  soort: string
  referral_id: string
  /** De toekenning waar deze mutatie op slaat. Leeg bij oudere regels: dan geldt referral_id. */
  hoort_bij?: string | null
  netto_cent: number | null
  created_at?: string
}

const hoortBij = (r: SaldoRegel) => r.hoort_bij ?? r.referral_id

/** Wat er van een toekenning over is: de toekenning, de vaststelling en alle mutaties erop. Negatief is een schuld. */
export function restVanToekenning(regels: SaldoRegel[], referralId: string): number {
  return regels.filter(r => hoortBij(r) === referralId).reduce((som, r) => som + (r.netto_cent ?? 0), 0)
}

/** Verval haalt alleen weg wat er nog is: nooit meer, en nooit iets bij een toekenning die al op of in schuld is. */
export function vervalBedrag(regels: SaldoRegel[], referralId: string): number {
  return -Math.max(0, restVanToekenning(regels, referralId)) || 0
}

/** Teruggedraaid en (nog) niet hersteld. */
export function isTeruggedraaid(regels: SaldoRegel[], referralId: string): boolean {
  const tel = (soort: string) => regels.filter(r => r.soort === soort && hoortBij(r) === referralId).length
  return tel('terugdraaiing') > tel('herstel')
}

export interface ToekenningRest {
  referralId: string
  restCent: number
  /** Wat hiervan echt te verrekenen is, nadat openstaande schulden eraf zijn (oudste eerst). */
  vrijCent: number
}

export interface Saldo {
  /** Nooit negatief. */
  beschikbaarCent: number
  /** Tegoed dat al gebruikt was en daarna is teruggedraaid: valt alleen weg tegen ander tegoed. */
  schuldCent: number
  /** Oudste toekenning eerst. */
  toekenningen: ToekenningRest[]
}

/** Het saldo van een aanbrenger. Geef alleen de regels van die ene aanbrenger mee. */
export function saldoVan(regels: SaldoRegel[]): Saldo {
  const toegekend = regels
    .filter(r => r.soort === 'toekenning')
    .sort((a, b) => Date.parse(a.created_at ?? '') - Date.parse(b.created_at ?? '') || (a.referral_id < b.referral_id ? -1 : 1))
  const rest = toegekend.map(t => ({ referralId: t.referral_id, restCent: restVanToekenning(regels, t.referral_id) }))
  const schuldCent = rest.reduce((som, t) => som + Math.max(0, -t.restCent), 0)
  let openSchuld = schuldCent
  const toekenningen = rest.map(t => {
    const positief = Math.max(0, t.restCent)
    const eraf = Math.min(openSchuld, positief)
    openSchuld -= eraf
    return { ...t, vrijCent: positief - eraf }
  })
  return { beschikbaarCent: toekenningen.reduce((som, t) => som + t.vrijCent, 0), schuldCent, toekenningen }
}

/** Van welke toekenningen dit bedrag afgaat: oudste eerst. Meer dan beschikbaar kan niet. */
export function verdeelVerrekening(regels: SaldoRegel[], nettoCent: number): { referralId: string; nettoCent: number }[] {
  let nog = nettoCent
  const delen: { referralId: string; nettoCent: number }[] = []
  for (const t of saldoVan(regels).toekenningen) {
    const deel = Math.min(nog, t.vrijCent)
    if (deel <= 0) continue
    delen.push({ referralId: t.referralId, nettoCent: deel })
    nog -= deel
  }
  if (nog > 0) throw new Error('Niet genoeg referraltegoed')
  return delen
}
