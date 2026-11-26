// Alles uit de referralautomatisering wat geld of boekhouding raakt staat achter een env-schakelaar. Standaard UIT:
// alleen exact de tekst 'true' zet aan. De andere schakelaars uit docs/REFERRAL_BOUWPLAN_R3.md (grootboek echt,
// teamkorting, overslaan, mails) bestaan nog niet, omdat wat erachter hoort nog niet gebouwd is.
//
// Een uitgezette schakelaar stopt nooit het afhandelen van wat al onderweg is: de machine blijft dan bij Mollie kijken
// wat er gebeurd is, maar verstuurt zelf niets meer.

export type ReferralSchakelaar = 'REFERRAL_TERUGSTORTEN' | 'REFERRAL_CREDITNOTA'

export const schakelaarAan = (naam: ReferralSchakelaar): boolean => process.env[naam] === 'true'
