// Wat moet er met een referral gebeuren? Puur rekenwerk bovenop de regels in referralRegels.ts: geen database.
// lib/billing/referralGrootboek.ts haalt de feiten op en schrijft de uitkomst in het grootboek.

import {
  BENODIGDE_MAANDEN, eersteBetalingOpTijd, kwalificatie, levertTegoedOp, tegoedNettoCent, tegoedStatus,
  type AanbrengerStand, type BetaaldePeriode,
} from './referralRegels'

export interface KlantFeiten {
  /** Einde van de proefperiode (aanmelding plus 30 dagen). */
  proefEindeAt: string | null
  /** Momenten van alle betalingen die zijn blijven staan, van elk abonnement, ook Basic per maand. */
  betaalMomenten: { at: string; team: boolean }[]
  periodes: BetaaldePeriode[]
  /** Op betaald gezet zonder betaling in ons systeem. */
  handmatigBetaald: boolean
  /** De proef van deze teammanager kan met de hand verlengd zijn: "te laat" is dan niet zeker. */
  proefMogelijkVerlengd: boolean
}

export interface AanbrengerFeiten {
  stand: AanbrengerStand
  handmatigBetaald: boolean
  /** Maandprijs exclusief btw van wat de aanbrenger nu betaalt, of het laatst betaalde. null: nooit betaald. */
  maandNettoCent: number | null
}

export type Beoordeling =
  | { uitkomst: 'wacht'; reden: string }
  | { uitkomst: 'toekennen'; reden: string; nettoCent: number | null; klantMaandNettoCent: number }
  | { uitkomst: 'afwijzen'; reden: string }
  | { uitkomst: 'handwerk'; reden: string }

export function beoordeelReferral(klant: KlantFeiten, aanbrenger: AanbrengerFeiten, nu: Date): Beoordeling {
  const eerste = [...klant.betaalMomenten].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
  if (!eerste) {
    if (klant.handmatigBetaald) return { uitkomst: 'handwerk', reden: 'klant staat met de hand op betaald' }
    return { uitkomst: 'wacht', reden: 'klant heeft nog niet betaald' }
  }

  if (!klant.proefEindeAt) return { uitkomst: 'handwerk', reden: 'proefperiode van de klant onbekend' }
  if (!eersteBetalingOpTijd(eerste.at, klant.proefEindeAt, eerste.team)) {
    return klant.proefMogelijkVerlengd
      ? { uitkomst: 'handwerk', reden: 'eerste teambetaling lijkt te laat, maar de teamproef kan verlengd zijn' }
      : { uitkomst: 'afwijzen', reden: 'eerste betaling te laat na de proef' }
  }

  const gehaald = kwalificatie(klant.periodes, nu)
  if (!gehaald) {
    const telt = klant.periodes.filter(p => p.geldig && levertTegoedOp(p.plan, p.cyclus))
    if (telt.some(p => p.cyclus === 'jaarlijks')) return { uitkomst: 'wacht', reden: 'bedenktijd van de klant loopt nog' }
    if (telt.length === 0) return { uitkomst: 'wacht', reden: 'nog geen abonnement dat tegoed oplevert' }
    return { uitkomst: 'wacht', reden: `drempel van ${BENODIGDE_MAANDEN} aaneengesloten maanden nog niet gehaald (${telt.length} betaald)` }
  }
  const klantMaandNettoCent = gehaald.periode.maandNettoCent

  if (aanbrenger.handmatigBetaald) return { uitkomst: 'handwerk', reden: 'aanbrenger staat met de hand op betaald' }

  const status = tegoedStatus(aanbrenger.stand, nu)
  if (status === 'vervallen') return { uitkomst: 'afwijzen', reden: 'aanbrenger had geen abonnement meer toen de drempel werd gehaald' }

  if (status === 'wacht') {
    // Net gestopt of geblokkeerd: nog niet beslissen, morgen opnieuw kijken. Nooit betaald (proef): wel toekennen,
    // het bedrag volgt bij zijn eerste abonnement.
    if (aanbrenger.stand.laatsteEindeAt || aanbrenger.stand.geblokkeerdSindsAt) {
      return { uitkomst: 'wacht', reden: 'drempel gehaald, maar het abonnement van de aanbrenger staat stil' }
    }
    return { uitkomst: 'toekennen', reden: 'aanbrenger heeft nog geen abonnement, bedrag volgt', nettoCent: null, klantMaandNettoCent }
  }

  if (aanbrenger.maandNettoCent === null) return { uitkomst: 'handwerk', reden: 'maandprijs van de aanbrenger niet te bepalen' }
  return {
    uitkomst: 'toekennen',
    reden: status === 'terugstorten' ? 'aanbrenger is teamlid: terugstorten over zijn eigen betalingen' : 'drempel gehaald',
    nettoCent: tegoedNettoCent(klantMaandNettoCent, aanbrenger.maandNettoCent),
    klantMaandNettoCent,
  }
}
