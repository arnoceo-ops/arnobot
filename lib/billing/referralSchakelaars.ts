// Alles uit de referralautomatisering wat geld of boekhouding raakt staat achter een env-schakelaar. Standaard UIT:
// alleen exact de tekst 'true' zet aan. REFERRAL_GROOTBOEK_ECHT staat in referralStand.ts. REFERRAL_MAILS: de klantmails
// (referralMails.ts). Teamkorting is niet gebouwd en heeft geen schakelaar; incasso overslaan is vervallen (altijd terugbetalen, 26-11-2026).
//
// REFERRAL_TERUGSTORTEN: de hoofdschakelaar, op zichzelf alleen het voordeel van de nieuwe klant.
// REFERRAL_TEGOED_VERREKENEN: daarbovenop nodig voor het tegoed van aanbrengers (ook het vervallen bij een teamlid).
//
// Een uitgezette schakelaar stopt nooit het afhandelen van wat al onderweg is: de machine blijft dan bij Mollie kijken
// wat er gebeurd is, maar verstuurt zelf niets meer.

export type ReferralSchakelaar = 'REFERRAL_TERUGSTORTEN' | 'REFERRAL_TEGOED_VERREKENEN' | 'REFERRAL_CREDITNOTA' | 'REFERRAL_MAILS'

export const schakelaarAan = (naam: ReferralSchakelaar): boolean => process.env[naam] === 'true'

/** Mag deze soort uitkering nu gereserveerd en verstuurd worden? */
export const magTerugstorten = (soort: string): boolean =>
  schakelaarAan('REFERRAL_TERUGSTORTEN') && (!soort.startsWith('tegoed') || schakelaarAan('REFERRAL_TEGOED_VERREKENEN'))
