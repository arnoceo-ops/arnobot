// De regels voor referraltegoed van de aanbrenger (Arno, 25-11-2026, docs/REFERRAL_AUTOMATISERING.md).
// Puur rekenwerk: geen database en geen betaalprovider. Alle tegoeden zijn in centen EXCLUSIEF btw; pas bij het
// verrekenen komt de btw erbij. Particulieren en zakelijke klanten betalen allebei btw (particulier zit hij in de
// getoonde prijs), dus uitkeren is voor beiden netto maal 1,21.

import { BTW_PERCENTAGE, berekenBedrag, type Bedrag, type Cyclus, type KlantType, type Plan } from './prijzen'
import { amsterdamDatum, laatsteDagBedenktijd } from './perioden'

export type ReferralPlan = Plan | 'team'

/** Hooguit zoveel dagen tussen twee betaalde maanden om nog aaneengesloten te tellen. */
export const MAX_ONDERBREKING_DAGEN = 14
export const BENODIGDE_MAANDEN = 3
/** Na de proef mag de eerste betaling nog zoveel dagen later vallen. */
export const TERMIJN_NA_PROEF_DAGEN = 15
export const TERMIJN_NA_TEAMPROEF_DAGEN = 10
/** Zo lang na het einde zonder nieuw abonnement vervalt het tegoed. */
export const VERVAL_NA_EINDE_DAGEN = 14
/** Zoveel dagen mag een periode de vorige overlappen en toch als nieuwe maand tellen. */
export const OVERLAP_MARGE_DAGEN = 1
/** Betaaltermijn van een teamfactuur (TEAM_BETAALTERMIJN_DAGEN in teamFacturatie.ts). */
export const FACTUURTERMIJN_DAGEN = 14
/** Een om wanbetaling geblokkeerd team verliest zijn tegoed na zoveel dagen blokkade. */
export const VERVAL_NA_BLOKKADE_DAGEN = 30

const DAG_MS = 24 * 60 * 60 * 1000
const btwFactor = 1 + BTW_PERCENTAGE / 100

/** Basic per maand levert niets op, al het andere wel. */
export function levertTegoedOp(plan: ReferralPlan, cyclus: Cyclus): boolean {
  return !(plan === 'basis' && cyclus === 'maandelijks')
}

/** Maandprijs exclusief btw van een individueel abonnement. Voor een team geeft de aanroeper de netto teamprijs per maand. */
export function maandNettoCent(plan: Plan, cyclus: Cyclus, klantType: KlantType): number {
  const netto = berekenBedrag(plan, cyclus, klantType).nettoCent
  return cyclus === 'jaarlijks' ? Math.round(netto / 12) : netto
}

/** Eenmalig tegoed: de laagste van de twee maandprijzen exclusief btw. */
export function tegoedNettoCent(klantMaandNettoCent: number, aanbrengerMaandNettoCent: number): number {
  return Math.max(0, Math.min(klantMaandNettoCent, aanbrengerMaandNettoCent))
}

export function brutoVanNetto(nettoCent: number): number {
  return Math.round(nettoCent * btwFactor)
}

/**
 * Hoeveel van het saldo in deze betaling past: wat wordt teruggestort of gekort, en wat van het saldo afgaat. Zou er door
 * afronding 1 cent netto overblijven, dan telt die als verbruikt. De databasefunctie referral_verrekening rekent precies
 * zo (docs/sql/2026-11-26-referral-verrekening.sql): wijzig ze altijd samen.
 */
export function verrekening(saldoNettoCent: number, betalingBrutoCent: number): { brutoCent: number; verbruiktNettoCent: number } {
  if (saldoNettoCent <= 0 || betalingBrutoCent <= 0) return { brutoCent: 0, verbruiktNettoCent: 0 }
  const vol = brutoVanNetto(saldoNettoCent)
  if (vol <= betalingBrutoCent) return { brutoCent: vol, verbruiktNettoCent: saldoNettoCent }
  const verbruikt = Math.min(saldoNettoCent, Math.round(betalingBrutoCent / btwFactor))
  return { brutoCent: betalingBrutoCent, verbruiktNettoCent: saldoNettoCent - verbruikt === 1 ? saldoNettoCent : verbruikt }
}

/** Telt de aanmelding? De eerste betaling moet vallen binnen de proef of de dagen erna (Amsterdamse kalenderdagen). */
export function eersteBetalingOpTijd(eersteBetalingAt: string, proefEindeAt: string, teamProef = false): boolean {
  const dagen = teamProef ? TERMIJN_NA_TEAMPROEF_DAGEN : TERMIJN_NA_PROEF_DAGEN
  const uiterlijk = amsterdamDatum(new Date(Date.parse(proefEindeAt) + dagen * DAG_MS))
  return amsterdamDatum(new Date(eersteBetalingAt)) <= uiterlijk
}

/**
 * Het moment dat telt voor "op tijd" bij een teamfactuur (besluit Arno 26-11-2026): betaald binnen de factuurtermijn,
 * dan telt de dag dat de factuur is aangemaakt. Later betaald, dan telt de betaaldag.
 */
export function tijdigMomentTeam(factuurAt: string | null | undefined, betaaldAt: string): string {
  if (!factuurAt || Date.parse(factuurAt) >= Date.parse(betaaldAt)) return betaaldAt
  const uiterlijk = amsterdamDatum(new Date(Date.parse(factuurAt) + FACTUURTERMIJN_DAGEN * DAG_MS))
  return amsterdamDatum(new Date(betaaldAt)) <= uiterlijk ? factuurAt : betaaldAt
}

export interface Maand<T> {
  periode: T
  /** Aantal aaneengesloten maanden tot en met deze periode. */
  reeks: number
  /** false: deze periode overlapt de vorige (dubbele betaling, opnieuw afgesloten) en is geen extra maand. */
  nieuw: boolean
}

/** Een periode waarvoor bewust niet is betaald: een overgeslagen incasso of een volledig verrekende teammaand. */
export interface GratisPeriode {
  periodeStart: string
  periodeEinde: string
}

/**
 * Telt aaneengesloten maanden. Overlappende periodes tellen niet dubbel, ze verlengen alleen het einde.
 *
 * Een gratis periode (`gratis: true`) is geen betaalde maand en breekt de reeks ook niet: zij schuift alleen het einde op
 * vanaf waar de onderbreking telt. Sluit zij zelf niet aan (meer dan 14 dagen na het vorige einde), dan herstelt zij die
 * onderbreking niet. Een betaalde periode die alleen met een gratis periode overlapt, telt gewoon mee: er is echt betaald.
 */
export function telMaanden<T extends { periodeStart: string; periodeEinde: string; gratis?: boolean }>(periodes: T[]): Maand<T>[] {
  let reeks = 0
  /** Tot waar er echt betaald is: hiermee wordt een dubbele betaling herkend. */
  let betaaldTot: number | null = null
  /** Tot waar de reeks loopt, gratis periodes meegeteld: hiermee wordt een onderbreking gemeten. */
  let ketenTot: number | null = null
  const marge = MAX_ONDERBREKING_DAGEN * DAG_MS
  return [...periodes]
    .sort((a, b) => Date.parse(a.periodeStart) - Date.parse(b.periodeStart) || Date.parse(a.periodeEinde) - Date.parse(b.periodeEinde))
    .map(periode => {
      const start = Date.parse(periode.periodeStart)
      const einde = Date.parse(periode.periodeEinde)
      if (periode.gratis) {
        if (ketenTot !== null && start - ketenTot <= marge) ketenTot = Math.max(ketenTot, einde)
        return { periode, reeks, nieuw: false }
      }
      if (betaaldTot !== null && start < betaaldTot - OVERLAP_MARGE_DAGEN * DAG_MS) {
        betaaldTot = Math.max(betaaldTot, einde)
        ketenTot = Math.max(ketenTot!, einde)
        return { periode, reeks, nieuw: false }
      }
      reeks = ketenTot !== null && start - ketenTot <= marge ? reeks + 1 : 1
      betaaldTot = einde
      ketenTot = ketenTot === null ? einde : Math.max(ketenTot, einde)
      return { periode, reeks, nieuw: true }
    })
}

/** De betaalde maanden en de gratis periodes door elkaar, klaar voor telMaanden. */
const metGratis = <T extends GratisPeriode>(betaald: T[], gratis: GratisPeriode[]) => [
  ...betaald.map(p => ({ periodeStart: p.periodeStart, periodeEinde: p.periodeEinde, gratis: false, betaald: p as T | null })),
  ...gratis.map(p => ({ periodeStart: p.periodeStart, periodeEinde: p.periodeEinde, gratis: true, betaald: null as T | null })),
]

/** Een betaalde periode van de aangebrachte klant. `geldig` is false bij niet betaald, terugbetaald of teruggeboekt. */
export interface BetaaldePeriode {
  plan: ReferralPlan
  cyclus: Cyclus
  klantType: KlantType
  periodeStart: string
  periodeEinde: string
  betaaldAt: string
  geldig: boolean
  /** Maandprijs exclusief btw van deze periode. */
  maandNettoCent: number
  /** Waar deze periode mee betaald is: het Mollie-kenmerk van de betaling, of bij een team het id van de teamfactuur. */
  bronId?: string
}

export interface Kwalificatie {
  /** De periode die de drempel haalt: haar abonnement bepaalt het bedrag. */
  periode: BetaaldePeriode
  /** De betalingen waarop de drempel rust: de jaarbetaling, of de drie maanden. */
  bronnen: BetaaldePeriode[]
}

/**
 * Is de drempel gehaald? Jaarabonnement: zakelijk direct na betaling, particulier na de bedenktijd. Per maand: drie
 * aaneengesloten maanden die betaald en verstreken zijn. Alleen abonnementen die tegoed opleveren tellen mee.
 */
export function kwalificatie(periodes: BetaaldePeriode[], nu: Date, gratis: GratisPeriode[] = []): Kwalificatie | null {
  const telt = periodes.filter(p => p.geldig && levertTegoedOp(p.plan, p.cyclus))
  const jaar = telt
    .filter(p => p.cyclus === 'jaarlijks')
    .sort((a, b) => Date.parse(a.periodeStart) - Date.parse(b.periodeStart))
    .find(p => p.klantType === 'zakelijk' || amsterdamDatum(nu) > laatsteDagBedenktijd(p.betaaldAt))
  const stand = telMaanden(metGratis(telt.filter(p => p.cyclus === 'maandelijks'), gratis))
  const drempel = stand.findIndex(m => m.nieuw && m.reeks >= BENODIGDE_MAANDEN && Date.parse(m.periode.periodeEinde) <= nu.getTime())
  const maand = drempel < 0 ? undefined : stand[drempel].periode.betaald!
  // Allebei gehaald: de eerste in de tijd.
  const periode = jaar && maand ? (Date.parse(jaar.periodeStart) <= Date.parse(maand.periodeStart) ? jaar : maand) : jaar ?? maand
  if (!periode) return null
  if (periode !== maand) return { periode, bronnen: [periode] }
  return { periode, bronnen: stand.slice(0, drempel + 1).filter(m => m.nieuw).slice(-BENODIGDE_MAANDEN).map(m => m.periode.betaald!) }
}

export interface AanbrengerStand {
  /** Heeft de aanbrenger nu een lopend abonnement (ook opgezegd maar nog niet afgelopen) of een lopend team? */
  loopt: boolean
  /** Einde van het laatste abonnement, als er ooit een was. */
  laatsteEindeAt: string | null
  /** Sinds wanneer het team om wanbetaling geblokkeerd is. */
  geblokkeerdSindsAt?: string | null
  /** Gewoon teamlid geworden: geen eigen abonnement meer, maar hij gebruikt ArnoBot nog. */
  isGewoonTeamlid?: boolean
  /** Nooit een abonnement gehad: de uiterste dag voor een eerste betaling. */
  eersteBetalingUiterlijkAt?: string | null
  /** Team met facturatie dat nog niet betaald heeft en niet geblokkeerd is: nog niets beslissen. */
  teamInAfwachting?: boolean
  /** Lifetime-houder: het tegoed vervalt niet (besluit Arno 26-11-2026). */
  lifetime?: boolean
}

/** Een tijdvak waarin de aanbrenger zelf een abonnement of betaald team had. einde null: loopt nog. */
export interface Dekking {
  start: string
  einde: string | null
  team: boolean
}

export interface AanbrengerHistorie {
  dekking: Dekking[]
  /** Uiterste dag voor het allereerste abonnement, voor een solo- en voor een teamstart. */
  eersteUiterlijk: { solo: string | null; team: string | null }
  /** De termijn die geldt zolang er nog niets is afgesloten. */
  uiterlijkZonderAbonnement?: string | null
  teamInAfwachting?: boolean
  isGewoonTeamlid?: boolean
  lifetimeSinds?: string | null
}

const naDag = (moment: number, grensIso: string) => amsterdamDatum(new Date(moment)) > amsterdamDatum(new Date(grensIso))

/**
 * Is het tegoed na deze aanmelding ooit definitief vervallen: het eerste abonnement kwam te laat, of er zat langer dan
 * 14 dagen niets tussen? Wie daarna terugkomt krijgt niets meer (besluit Arno 26-11-2026). Een aanmelding van ná
 * zo'n gat telt gewoon.
 */
export function vervallenNaAanmelding(h: AanbrengerHistorie, aangemeldAt: string, nu: Date): boolean {
  // Wie teamlid wordt stopt niet.
  if (h.isGewoonTeamlid) return false
  const aangemeld = Date.parse(aangemeldAt)
  const raakt = (vervalMoment: number) => aangemeld < vervalMoment
    && !(h.lifetimeSinds && Date.parse(h.lifetimeSinds) <= vervalMoment)
  const blokken = [...h.dekking].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const eerste = blokken[0]
  // Nooit iets afgesloten: dat beoordeelt tegoedStatus. Alleen Lifetime ná de verlopen termijn redt niets meer.
  if (!eerste) {
    const termijn = h.uiterlijkZonderAbonnement
    return !!h.lifetimeSinds && !!termijn && naDag(Date.parse(h.lifetimeSinds), termijn) && raakt(Date.parse(termijn))
  }
  const uiterlijk = eerste.team ? h.eersteUiterlijk.team : h.eersteUiterlijk.solo
  if (uiterlijk && naDag(Date.parse(eerste.start), uiterlijk) && raakt(Date.parse(uiterlijk))) return true

  const respijt = VERVAL_NA_EINDE_DAGEN * DAG_MS
  const eind = (d: Dekking) => (d.einde === null ? Infinity : Date.parse(d.einde))
  let tot = eind(eerste)
  for (const d of blokken.slice(1)) {
    if (Date.parse(d.start) > tot + respijt && raakt(tot + respijt)) return true
    tot = Math.max(tot, eind(d))
  }
  return !h.teamInAfwachting && nu.getTime() > tot + respijt && raakt(tot + respijt)
}

/**
 * 'actief': tegoed ontstaat en mag verrekend worden. 'terugstorten': teamlid geworden, tegoed (ook van referrals van
 * voor de overstap die later de drempel halen) gaat terug over zijn eigen eerdere betalingen. 'wacht': staat stil.
 * 'vervallen': definitief weg.
 */
export type TegoedStatus = 'actief' | 'terugstorten' | 'wacht' | 'vervallen'

/** Wanneer de huidige stand tot verval leidt of leidde. null: daar is geen moment voor te geven. */
export function vervalMoment(s: AanbrengerStand): number | null {
  if (s.isGewoonTeamlid) return null
  if (s.geblokkeerdSindsAt) return Date.parse(s.geblokkeerdSindsAt) + VERVAL_NA_BLOKKADE_DAGEN * DAG_MS
  if (s.laatsteEindeAt) return Date.parse(s.laatsteEindeAt) + VERVAL_NA_EINDE_DAGEN * DAG_MS
  return s.eersteBetalingUiterlijkAt ? Date.parse(s.eersteBetalingUiterlijkAt) : null
}

export function tegoedStatus(s: AanbrengerStand, nu: Date): TegoedStatus {
  const voorbij = (vanaf: string, dagen: number) => nu.getTime() > Date.parse(vanaf) + dagen * DAG_MS
  const vervallen: TegoedStatus = s.lifetime ? 'wacht' : 'vervallen'
  // Wie teamlid wordt stopt niet. Heeft hij ooit zelf betaald, dan is er iets om op terug te storten.
  if (s.isGewoonTeamlid) return s.laatsteEindeAt ? 'terugstorten' : vervallen
  if (s.geblokkeerdSindsAt) return voorbij(s.geblokkeerdSindsAt, VERVAL_NA_BLOKKADE_DAGEN) ? vervallen : 'wacht'
  if (s.loopt) return 'actief'
  // Solo naar Team, of een eerste teamfactuur die nog openstaat.
  if (s.teamInAfwachting) return 'wacht'
  if (s.laatsteEindeAt) return voorbij(s.laatsteEindeAt, VERVAL_NA_EINDE_DAGEN) ? vervallen : 'wacht'
  // Nog nooit betaald (proef): het tegoed wacht tot en met de laatste dag voor een eerste abonnement.
  if (s.eersteBetalingUiterlijkAt && naDag(nu.getTime(), s.eersteBetalingUiterlijkAt)) return vervallen
  return 'wacht'
}

/** Een eigen betaling van de aanbrenger. beschikbaarCent: betaald, minus alles wat al is terugbetaald of teruggeboekt. */
export interface EigenBetaling {
  id: string
  betaaldAt: string
  beschikbaarCent: number
}

/**
 * Teruggestort over de eigen eerdere betalingen, nieuwste eerst, nooit meer dan hij zelf betaalde. Wat daar niet in
 * past vervalt. Gebruikt als de aanbrenger gewoon teamlid is geworden.
 */
export function verdeelOverEigenBetalingen(
  saldoNettoCent: number,
  betalingen: EigenBetaling[],
): { delen: { id: string; brutoCent: number; verbruiktNettoCent: number }[]; vervaltNettoCent: number } {
  let rest = Math.max(0, saldoNettoCent)
  const delen: { id: string; brutoCent: number; verbruiktNettoCent: number }[] = []
  for (const b of [...betalingen].sort((x, y) => Date.parse(y.betaaldAt) - Date.parse(x.betaaldAt))) {
    if (rest <= 0) break
    const v = verrekening(rest, b.beschikbaarCent)
    if (v.brutoCent <= 0) continue
    delen.push({ id: b.id, ...v })
    rest -= v.verbruiktNettoCent
  }
  return { delen, vervaltNettoCent: rest }
}

// ── Voordeel voor de aangebrachte (nieuwe) klant, Arno 25-11-2026 ──
// Eenmalig, bij dezelfde termijn als hierboven (eersteBetalingOpTijd), voor elk abonnement, ook Basic per maand.
// Jaarabonnement: een maand korting bij het afrekenen (bij herroeping krijgt hij gewoon terug wat hij betaalde).
// Maandabonnement: de vierde betaalde maand gratis, na drie aaneengesloten betaalde maanden.

/** Korting op de eerste jaarbetaling: een twaalfde van het jaarbedrag. Verlengingen zijn weer de volle prijs. */
export function jaarKortingCent(jaarBedragCent: number): number {
  return Math.round(Math.max(0, jaarBedragCent) / 12)
}

/** Het bedrag van de eerste jaarbetaling met de referral fee, inclusief het bijbehorende btw-deel. */
export function metJaarKorting(jaar: Bedrag): { bedrag: Bedrag; kortingBrutoCent: number; kortingNettoCent: number } {
  const kortingBrutoCent = jaarKortingCent(jaar.brutoCent)
  const brutoCent = jaar.brutoCent - kortingBrutoCent
  const nettoCent = Math.round(brutoCent / btwFactor)
  return { bedrag: { brutoCent, nettoCent, btwCent: brutoCent - nettoCent }, kortingBrutoCent, kortingNettoCent: jaar.nettoCent - nettoCent }
}

/**
 * De betaalde maand die de klant gratis krijgt (wordt afgeschreven en daarna teruggestort): de vierde in een reeks
 * aaneengesloten betaalde maanden. null zolang die er niet is.
 */
export function gratisVierdeMaand(periodes: BetaaldePeriode[], gratis: GratisPeriode[] = []): BetaaldePeriode | null {
  return telMaanden(metGratis(periodes.filter(p => p.geldig && p.cyclus === 'maandelijks'), gratis))
    .find(m => m.nieuw && m.reeks === BENODIGDE_MAANDEN + 1)?.periode.betaald ?? null
}

/** Bij een team is de gratis maand nooit meer dan de maandprijs waarmee het team begon (later toegevoegde gebruikers tellen niet). */
export function gratisMaandBrutoCent(betalingBrutoCent: number, teamStartMaandBrutoCent?: number): number {
  return Math.max(0, teamStartMaandBrutoCent === undefined ? betalingBrutoCent : Math.min(betalingBrutoCent, teamStartMaandBrutoCent))
}
