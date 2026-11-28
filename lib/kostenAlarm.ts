// Melding aan Arno zodra een betalende klant deze maand 80% (en nog een keer bij 100%) heeft gekost van wat die klant per maand betaalt
// (besluit Arno 2026-11-28). Wie niet betaalt (proef, gratis toegang) telt niet mee. Puur en getest, de cron staat in
// app/api/cron/kosten-alarm.
//
// Betaald per maand: wat er werkelijk is betaald, zonder btw, met terugbetalingen eraf; een jaarbetaling gedeeld door 12.
// Kosten: de gemeten AI- en spraakkosten van de kalendermaand (lib/gebruikerKosten.ts). Dat is een ondergrens: live dicteren en
// embeddings worden niet geprijsd en vaste kosten tellen niet per klant.

export const KOSTEN_ALARM_DREMPELS = [80, 100] as const
export type Drempel = (typeof KOSTEN_ALARM_DREMPELS)[number]

export type Abonnement = {
  id: string
  user_id: string
  plan: string
  cyclus: string
  status: string
  bedrag_cent: number
  btw_cent: number
  periode_einde: string | null
}

export type Betaling = {
  subscription_id: string | null
  soort: string
  status: string
  bedrag_cent: number
  btw_cent: number | null
  terugbetaald_cent: number | null
  betaald_at: string | null
  /** Momentopname bij de betaling; ontbreekt bij oude rijen. */
  cyclus?: string | null
}

export type TeamFactuur = {
  team_id: string
  status: string
  soort: string
  cyclus: string
  periode_start: string
  periode_einde: string
  bedrag_cent: number
  btw_cent: number
  terugbetaald_cent?: number | null
}

export type Klant = {
  /** Sleutel voor de eenmalige melding: user_id, of "team:<id>". */
  sleutel: string
  /** De gebruikers wier kosten samen bij deze betaling horen. */
  userIds: string[]
  omschrijving: string
  perMaandCent: number
}

const DAG_MS = 86_400_000
const LOPEND = ['active', 'cancelled']
const PLAN_NAAM: Record<string, string> = { basis: 'Basic', premium: 'Pro' }

function nettoNaTerugbetaling(bedragCent: number, btwCent: number, terugCent: number): number {
  if (bedragCent <= 0) return 0
  return Math.max(0, bedragCent - terugCent) * ((bedragCent - btwCent) / bedragCent)
}

/**
 * Wat een solo klant nu per maand betaalt, in centen zonder btw, of null als hij niet betaalt: geen lopend abonnement, een verlopen
 * periode of geen betaling die is blijven staan. De laatste gewone betaling telt (dan werken kortingen en terugbetalingen door). Na een
 * upgrade of een wisseling van cyclus klopt die niet meer: dan geldt het bedrag van het abonnement zelf.
 */
export function soloPerMaandCent(abo: Abonnement, betalingen: Betaling[], nu: Date): number | null {
  if (!LOPEND.includes(abo.status)) return null
  if (abo.periode_einde && new Date(abo.periode_einde).getTime() < nu.getTime()) return null
  const betaald = betalingen
    .filter(b => b.subscription_id === abo.id && b.status === 'paid' && !!b.betaald_at)
    .sort((a, b) => a.betaald_at!.localeCompare(b.betaald_at!))
  const gewoon = betaald.filter(b => b.soort !== 'upgrade').at(-1)
  if (!gewoon) return null
  const gewoonNetto = nettoNaTerugbetaling(gewoon.bedrag_cent, gewoon.btw_cent ?? 0, gewoon.terugbetaald_cent ?? 0)
  if (gewoonNetto <= 0) return null
  const gewijzigd = (!!gewoon.cyclus && gewoon.cyclus !== abo.cyclus)
    || betaald.some(b => b.soort === 'upgrade' && b.betaald_at! > gewoon.betaald_at!)
  const periodeBedrag = gewijzigd ? abo.bedrag_cent - abo.btw_cent : gewoonNetto
  return periodeBedrag / (abo.cyclus === 'jaarlijks' ? 12 : 1)
}

export function soloKlanten(abonnementen: Abonnement[], betalingen: Betaling[], nu: Date): Klant[] {
  const perGebruiker = new Map<string, Klant>()
  for (const a of abonnementen) {
    const cent = soloPerMaandCent(a, betalingen, nu)
    if (cent === null) continue
    // Twee lopende abonnementen (overgang): het hoogste bedrag, anders komt de melding te vroeg.
    if ((perGebruiker.get(a.user_id)?.perMaandCent ?? -1) >= cent) continue
    perGebruiker.set(a.user_id, {
      sleutel: a.user_id, userIds: [a.user_id], perMaandCent: cent,
      omschrijving: `${PLAN_NAAM[a.plan] ?? a.plan} ${a.cyclus}`,
    })
  }
  return [...perGebruiker.values()]
}

/** Na afloop van een betaalde periode telt een factuur nog zo lang mee: de volgende staat dan vaak nog open. */
const TEAM_RESPIJT_DAGEN = 31

/**
 * Wat een team per maand betaalt: de betaalde facturen die nu lopen (of hooguit 31 dagen geleden afliepen, dan alleen de laatste).
 * Een jaarfactuur gedeeld door 12, een tussentijdse factuur gespreid over de maanden die ze dekt.
 */
export function teamPerMaandCent(facturen: TeamFactuur[], nu: Date): number | null {
  const vandaag = nu.toISOString().slice(0, 10)
  const grens = new Date(nu.getTime() - TEAM_RESPIJT_DAGEN * DAG_MS).toISOString().slice(0, 10)
  const betaald = facturen.filter(f => f.status === 'paid' && f.periode_start <= vandaag && f.periode_einde >= grens)
  const regulier = betaald.filter(f => f.soort !== 'tussentijds').sort((a, b) => a.periode_start.localeCompare(b.periode_start)).at(-1)
  if (!regulier) return null
  const maanden = (f: TeamFactuur) => {
    if (f.soort !== 'tussentijds') return f.cyclus === 'jaarlijks' ? 12 : 1
    return Math.max(1, (Date.parse(f.periode_einde) - Date.parse(f.periode_start)) / (DAG_MS * 365 / 12))
  }
  const som = [regulier, ...betaald.filter(f => f.soort === 'tussentijds' && f.periode_einde >= vandaag)]
    .reduce((s, f) => s + nettoNaTerugbetaling(f.bedrag_cent, f.btw_cent, f.terugbetaald_cent ?? 0) / maanden(f), 0)
  return som > 0 ? som : null
}

export type Alarm = {
  klant: Klant
  drempel: Drempel
  kostenCent: number
  pct: number
}

/** De klanten die een drempel hebben bereikt, met per klant alleen de hoogste. */
export function bepaalAlarmen(klanten: Klant[], kostenUsdPerGebruiker: Map<string, number>, fxEurUsd: number): Alarm[] {
  const uit: Alarm[] = []
  for (const klant of klanten) {
    const usd = klant.userIds.reduce((s, id) => s + (kostenUsdPerGebruiker.get(id) ?? 0), 0)
    const kostenCent = (usd / fxEurUsd) * 100
    const pct = (kostenCent / klant.perMaandCent) * 100
    // Een minimale marge: precies op de grens mag door de wisselkoersberekening niet 99,999999% worden.
    const drempel = [...KOSTEN_ALARM_DREMPELS].reverse().find(d => pct >= d - 1e-6)
    if (drempel) uit.push({ klant, drempel, kostenCent, pct })
  }
  return uit.sort((a, b) => b.pct - a.pct)
}

const euro = (cent: number) => '€' + (cent / 100).toFixed(2).replace('.', ',')

/**
 * Tekst voor Telegram. `verlopenDeel` is het deel van de maand dat voorbij is (0 tot 1); bij een volledige maand valt de verwachting weg.
 * In de eerste drie dagen zegt een verwachting niets.
 */
export function bouwAlarmTekst(alarm: Alarm, wie: string, maandNaam: string, verlopenDeel: number): string {
  const regels = [
    alarm.drempel >= 100 ? 'Klant kost meer dan die betaalt (arno.bot)' : `Klant op ${KOSTEN_ALARM_DREMPELS[0]}% van de maandbetaling (arno.bot)`,
    '',
    `Wie: ${wie}`,
    `Abonnement: ${alarm.klant.omschrijving}`,
    `Betaalt per maand: ${euro(alarm.klant.perMaandCent)} excl. btw`,
    verlopenDeel >= 1 ? `Kosten ${maandNaam}: ${euro(alarm.kostenCent)} (${Math.round(alarm.pct)}%)`
      : `Kosten ${maandNaam} tot nu toe: ${euro(alarm.kostenCent)} (${Math.round(alarm.pct)}%)`,
  ]
  if (verlopenDeel >= 0.1 && verlopenDeel < 1) regels.push(`Verwachting einde maand: ${euro(alarm.kostenCent / verlopenDeel)}`)
  return regels.join('\n')
}

export type AlarmStore = {
  set(sleutel: string, waarde: string, opties: { nx: true; ex: number }): Promise<unknown>
  del(sleutel: string): Promise<unknown>
}

/**
 * Elke drempel hooguit een keer per klant per maand. Wie meteen op 100% staat, krijgt later niet alsnog de melding van 80%. Komt het
 * bericht niet aan, dan wordt het de volgende ochtend opnieuw geprobeerd. Geeft het aantal verstuurde meldingen.
 */
export async function verstuurAlarmen(
  alarmen: Alarm[],
  maand: string,
  store: AlarmStore,
  maakTekst: (alarm: Alarm) => Promise<string>,
  stuur: (tekst: string) => Promise<boolean>,
): Promise<{ verstuurd: number; mislukt: number }> {
  const uit = { verstuurd: 0, mislukt: 0 }
  const sleutelVan = (a: Alarm, d: number) => `kostenalarm:${a.klant.sleutel}:${maand}:${d}`
  const opties = { nx: true as const, ex: 70 * 86_400 }
  for (const alarm of alarmen) {
    const sleutel = sleutelVan(alarm, alarm.drempel)
    if (!(await store.set(sleutel, '1', opties))) continue
    const gelukt = await stuur(await maakTekst(alarm))
    if (!gelukt) {
      await store.del(sleutel)
      uit.mislukt++
      continue
    }
    for (const lager of KOSTEN_ALARM_DREMPELS.filter(d => d < alarm.drempel)) await store.set(sleutelVan(alarm, lager), '1', opties)
    uit.verstuurd++
  }
  return uit
}
