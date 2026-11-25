// De regels voor referraltegoed van de aanbrenger (Arno, 25-11-2026, docs/REFERRAL_AUTOMATISERING.md).
// Puur rekenwerk: geen database en geen betaalprovider. Alle tegoeden zijn in centen EXCLUSIEF btw; pas bij het
// verrekenen komt de btw erbij. Particulieren en zakelijke klanten betalen allebei btw (particulier zit hij in de
// getoonde prijs), dus uitkeren is voor beiden netto maal 1,21.

import { BTW_PERCENTAGE, berekenBedrag, type Cyclus, type KlantType, type Plan } from './prijzen'
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

/** Hoeveel van het saldo in deze betaling past: wat wordt teruggestort of gekort, en wat van het saldo afgaat. */
export function verrekening(saldoNettoCent: number, betalingBrutoCent: number): { brutoCent: number; verbruiktNettoCent: number } {
  if (saldoNettoCent <= 0 || betalingBrutoCent <= 0) return { brutoCent: 0, verbruiktNettoCent: 0 }
  const vol = brutoVanNetto(saldoNettoCent)
  if (vol <= betalingBrutoCent) return { brutoCent: vol, verbruiktNettoCent: saldoNettoCent }
  return { brutoCent: betalingBrutoCent, verbruiktNettoCent: Math.min(saldoNettoCent, Math.round(betalingBrutoCent / btwFactor)) }
}

/** Telt de aanmelding? De eerste betaling moet vallen binnen de proef of de dagen erna (Amsterdamse kalenderdagen). */
export function eersteBetalingOpTijd(eersteBetalingAt: string, proefEindeAt: string, teamProef = false): boolean {
  const dagen = teamProef ? TERMIJN_NA_TEAMPROEF_DAGEN : TERMIJN_NA_PROEF_DAGEN
  const uiterlijk = amsterdamDatum(new Date(Date.parse(proefEindeAt) + dagen * DAG_MS))
  return amsterdamDatum(new Date(eersteBetalingAt)) <= uiterlijk
}

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
}

export interface Kwalificatie {
  /** De periode die de drempel haalt: haar abonnement bepaalt het bedrag. */
  periode: BetaaldePeriode
}

/**
 * Is de drempel gehaald? Jaarabonnement: zakelijk direct na betaling, particulier na de bedenktijd. Per maand: drie
 * aaneengesloten maanden die betaald en verstreken zijn. Alleen abonnementen die tegoed opleveren tellen mee.
 */
export function kwalificatie(periodes: BetaaldePeriode[], nu: Date): Kwalificatie | null {
  const telt = periodes
    .filter(p => p.geldig && levertTegoedOp(p.plan, p.cyclus))
    .sort((a, b) => Date.parse(a.periodeStart) - Date.parse(b.periodeStart))

  let reeks = 0
  let vorigeEinde: number | null = null
  for (const p of telt) {
    if (p.cyclus === 'jaarlijks') {
      const bedenktijdVoorbij = amsterdamDatum(nu) > laatsteDagBedenktijd(p.betaaldAt)
      if (p.klantType === 'zakelijk' || bedenktijdVoorbij) return { periode: p }
      continue
    }
    const aansluitend = vorigeEinde !== null && Date.parse(p.periodeStart) - vorigeEinde <= MAX_ONDERBREKING_DAGEN * DAG_MS
    reeks = aansluitend ? reeks + 1 : 1
    vorigeEinde = Date.parse(p.periodeEinde)
    if (reeks >= BENODIGDE_MAANDEN && Date.parse(p.periodeEinde) <= nu.getTime()) return { periode: p }
  }
  return null
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
}

/**
 * 'actief': tegoed ontstaat en mag verrekend worden. 'terugstorten': teamlid geworden, tegoed (ook van referrals van
 * voor de overstap die later de drempel halen) gaat terug over zijn eigen eerdere betalingen. 'wacht': staat stil.
 * 'vervallen': definitief weg.
 */
export type TegoedStatus = 'actief' | 'terugstorten' | 'wacht' | 'vervallen'

export function tegoedStatus(s: AanbrengerStand, nu: Date): TegoedStatus {
  const voorbij = (vanaf: string, dagen: number) => nu.getTime() > Date.parse(vanaf) + dagen * DAG_MS
  // Wie teamlid wordt stopt niet. Heeft hij ooit zelf betaald, dan is er iets om op terug te storten.
  if (s.isGewoonTeamlid) return s.laatsteEindeAt ? 'terugstorten' : 'vervallen'
  if (s.geblokkeerdSindsAt) return voorbij(s.geblokkeerdSindsAt, VERVAL_NA_BLOKKADE_DAGEN) ? 'vervallen' : 'wacht'
  if (s.loopt) return 'actief'
  if (s.laatsteEindeAt) return voorbij(s.laatsteEindeAt, VERVAL_NA_EINDE_DAGEN) ? 'vervallen' : 'wacht'
  // Nog nooit betaald (proef): het tegoed wacht tot de termijn voor een eerste abonnement voorbij is.
  if (s.eersteBetalingUiterlijkAt && nu.getTime() > Date.parse(s.eersteBetalingUiterlijkAt)) return 'vervallen'
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

/**
 * De betaalde maand die de klant gratis krijgt (wordt afgeschreven en daarna teruggestort): de vierde in een reeks
 * aaneengesloten betaalde maanden. null zolang die er niet is.
 */
export function gratisVierdeMaand(periodes: BetaaldePeriode[]): BetaaldePeriode | null {
  const maanden = periodes
    .filter(p => p.geldig && p.cyclus === 'maandelijks')
    .sort((a, b) => Date.parse(a.periodeStart) - Date.parse(b.periodeStart))
  let reeks = 0
  let vorigeEinde: number | null = null
  for (const p of maanden) {
    const aansluitend = vorigeEinde !== null && Date.parse(p.periodeStart) - vorigeEinde <= MAX_ONDERBREKING_DAGEN * DAG_MS
    reeks = aansluitend ? reeks + 1 : 1
    vorigeEinde = Date.parse(p.periodeEinde)
    if (reeks === BENODIGDE_MAANDEN + 1) return p
  }
  return null
}

/** Bij een team is de gratis maand nooit meer dan de maandprijs waarmee het team begon (later toegevoegde gebruikers tellen niet). */
export function gratisMaandBrutoCent(betalingBrutoCent: number, teamStartMaandBrutoCent?: number): number {
  return Math.max(0, teamStartMaandBrutoCent === undefined ? betalingBrutoCent : Math.min(betalingBrutoCent, teamStartMaandBrutoCent))
}
