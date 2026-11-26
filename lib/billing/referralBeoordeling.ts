// Wat moet er met een referral gebeuren? Puur rekenwerk bovenop de regels in referralRegels.ts: geen database.
// lib/billing/referralGrootboek.ts haalt de feiten op en schrijft de uitkomst in het grootboek.

import {
  BENODIGDE_MAANDEN, eersteBetalingOpTijd, kwalificatie, levertTegoedOp, tegoedNettoCent, tegoedStatus, vervallenNaAanmelding,
  type AanbrengerHistorie, type AanbrengerStand, type BetaaldePeriode,
} from './referralRegels'

export interface KlantFeiten {
  /** Aanmelding via de referral. De termijnen rekenen hiervandaan, ook na een tweede proefperiode. */
  aangemeldAt: string | null
  /** Einde van de eerste proefperiode (aanmelding plus 30 dagen). */
  proefEindeAt: string | null
  /**
   * Betalingen die niet helemaal zijn teruggedraaid, van elk abonnement, ook Basic per maand. Bij een teamfactuur die
   * binnen de termijn is betaald is `at` de dag dat de factuur is aangemaakt.
   */
  betaalMomenten: { at: string; team: boolean }[]
  periodes: BetaaldePeriode[]
  /** Op betaald gezet zonder betaling in ons systeem. */
  handmatigBetaald: boolean
  /** Ooit met de knop BETAALD gezet, ook als er daarna online is betaald. */
  ooitMetDeHandBetaald: boolean
  /** De proef van deze teammanager kan met de hand verlengd zijn: "te laat" is dan niet zeker. */
  proefMogelijkVerlengd: boolean
  /** Een upgrade waarvan de bijbetaling nog niet binnen is. */
  bijbetalingLoopt: boolean
}

export interface AanbrengerFeiten {
  stand: AanbrengerStand
  historie: AanbrengerHistorie
  /** Dezelfde historie, waarin een team pas begint bij een factuur die nu betaald staat. */
  strengeHistorie?: AanbrengerHistorie
  handmatigBetaald: boolean
  /** Ooit met de hand op betaald gezet, gratis toegang gehad of teamlid geweest: dan nooit automatisch tegen hem beslissen. */
  historieOnvolledig: boolean
  /** Maandprijs exclusief btw van wat de aanbrenger nu betaalt, of het laatst betaalde. null: nooit betaald. */
  maandNettoCent: number | null
  bijbetalingLoopt: boolean
}

export type Beoordeling =
  | { uitkomst: 'wacht'; reden: string }
  | { uitkomst: 'toekennen'; reden: string; nettoCent: number | null; klantMaandNettoCent: number }
  | { uitkomst: 'afwijzen'; reden: string }
  | { uitkomst: 'handwerk'; reden: string }

const wacht = (reden: string): Beoordeling => ({ uitkomst: 'wacht', reden })
const handwerk = (reden: string): Beoordeling => ({ uitkomst: 'handwerk', reden })

export const TEAMBEGIN_ONZEKER = 'het begin van het team van de aanbrenger hangt af van een teamfactuur die niet of niet meer betaald is'

export function beoordeelReferral(klant: KlantFeiten, aanbrenger: AanbrengerFeiten, nu: Date): Beoordeling {
  const uitkomst = beoordeel(klant, aanbrenger, nu)
  // Zou het tegoed vervallen zijn als een nooit betaalde of teruggedraaide teamfactuur niet meetelt, dan beslist Arno.
  if (uitkomst.uitkomst === 'toekennen' && aanbrenger.strengeHistorie
    && vervallenNaAanmelding(aanbrenger.strengeHistorie, klant.aangemeldAt!, nu)) {
    return handwerk(TEAMBEGIN_ONZEKER)
  }
  return uitkomst
}

function beoordeel(klant: KlantFeiten, aanbrenger: AanbrengerFeiten, nu: Date): Beoordeling {
  const eerste = [...klant.betaalMomenten].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
  if (!eerste) {
    return klant.handmatigBetaald ? handwerk('klant staat met de hand op betaald') : wacht('klant heeft nog niet betaald')
  }

  if (!klant.aangemeldAt || !klant.proefEindeAt) return handwerk('aanmelddatum van de klant onbekend')
  if (!eersteBetalingOpTijd(eerste.at, klant.proefEindeAt, eerste.team)) {
    if (klant.proefMogelijkVerlengd) return handwerk('eerste teambetaling lijkt te laat, maar de teamproef kan verlengd zijn')
    if (klant.handmatigBetaald || klant.ooitMetDeHandBetaald) return handwerk('eerste betaling lijkt te laat, maar de klant stond ook met de hand op betaald')
    return { uitkomst: 'afwijzen', reden: 'eerste betaling te laat na de proef' }
  }
  if (klant.bijbetalingLoopt) return wacht('bijbetaling van een upgrade van de klant loopt nog')

  const gehaald = kwalificatie(klant.periodes, nu)
  if (!gehaald) {
    if (klant.handmatigBetaald) return handwerk('klant staat ook met de hand op betaald, de betaalde maanden zijn niet te tellen')
    const telt = klant.periodes.filter(p => p.geldig && levertTegoedOp(p.plan, p.cyclus))
    if (telt.some(p => p.cyclus === 'jaarlijks')) return wacht('bedenktijd van de klant loopt nog')
    if (telt.length === 0) return wacht('nog geen abonnement dat tegoed oplevert')
    return wacht(`drempel van ${BENODIGDE_MAANDEN} aaneengesloten maanden nog niet gehaald (${telt.length} betaald)`)
  }
  const klantMaandNettoCent = gehaald.periode.maandNettoCent

  if (aanbrenger.handmatigBetaald) return handwerk('aanbrenger staat met de hand op betaald')
  if (vervallenNaAanmelding(aanbrenger.historie, klant.aangemeldAt, nu)) {
    if (aanbrenger.historieOnvolledig) return handwerk('aanbrenger lijkt zonder abonnement te zijn geweest, maar stond ook met de hand op betaald, had gratis toegang of was teamlid')
    return { uitkomst: 'afwijzen', reden: 'aanbrenger zat na deze aanmelding zonder abonnement, tegoed vervallen' }
  }

  const status = tegoedStatus(aanbrenger.stand, nu)
  if (status === 'vervallen') {
    if (aanbrenger.historieOnvolledig) return handwerk('aanbrenger lijkt geen abonnement meer te hebben, maar stond ook met de hand op betaald, had gratis toegang of was teamlid')
    return { uitkomst: 'afwijzen', reden: 'aanbrenger had geen abonnement meer toen de drempel werd gehaald' }
  }

  const lifetime = !!aanbrenger.stand.lifetime
  if (status === 'wacht' && !lifetime) {
    if (aanbrenger.stand.teamInAfwachting) return wacht('drempel gehaald, maar de eerste teamfactuur van de aanbrenger is nog niet betaald')
    // Net gestopt of geblokkeerd: nog niet beslissen, morgen opnieuw kijken. Nooit betaald (proef): wel toekennen,
    // het bedrag volgt bij de eerste verrekening.
    if (aanbrenger.stand.laatsteEindeAt || aanbrenger.stand.geblokkeerdSindsAt) {
      return wacht('drempel gehaald, maar het abonnement van de aanbrenger staat stil')
    }
    return { uitkomst: 'toekennen', reden: 'aanbrenger heeft nog geen abonnement, bedrag volgt', nettoCent: null, klantMaandNettoCent }
  }

  if (aanbrenger.bijbetalingLoopt) return wacht('drempel gehaald, maar de bijbetaling van een upgrade van de aanbrenger loopt nog')
  if (aanbrenger.maandNettoCent === null) {
    return lifetime
      ? { uitkomst: 'toekennen', reden: 'lifetime zonder betaald abonnement, bedrag volgt', nettoCent: null, klantMaandNettoCent }
      : handwerk('maandprijs van de aanbrenger niet te bepalen')
  }
  return {
    uitkomst: 'toekennen',
    reden: status === 'terugstorten' ? 'aanbrenger is teamlid: terugstorten over zijn eigen betalingen' : 'drempel gehaald',
    nettoCent: tegoedNettoCent(klantMaandNettoCent, aanbrenger.maandNettoCent),
    klantMaandNettoCent,
  }
}
