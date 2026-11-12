import { BTW_PERCENTAGE, berekenBedrag, type Bedrag, type Cyclus, type KlantType } from './prijzen'

/**
 * Wat een klant bijbetaalt bij een upgrade van Basic naar Pro midden in een betaalperiode: het
 * prijsverschil, naar rato van de nog resterende tijd van die periode (docs/OVERSTAP_PLAN.md).
 * De server rekent dit zelf uit; een bedrag van de client wordt nooit vertrouwd.
 *
 * Particulier: het getoonde bedrag is inclusief btw, dus het verschil wordt bruto berekend en de btw
 * eruit gehaald. Zakelijk: het verschil wordt netto berekend en de 21% komt erbovenop. Een periode
 * die al voorbij is geeft 0.
 */
export function berekenUpgradeBedrag(
  klantType: KlantType,
  cyclus: Cyclus,
  periodeStart: Date,
  periodeEinde: Date,
  nu: Date,
): Bedrag {
  const basic = berekenBedrag('basis', cyclus, klantType)
  const pro = berekenBedrag('premium', cyclus, klantType)
  const totaal = periodeEinde.getTime() - periodeStart.getTime()
  const rest = Math.min(Math.max(periodeEinde.getTime() - nu.getTime(), 0), Math.max(totaal, 0))
  const ratio = totaal > 0 ? rest / totaal : 0

  if (klantType === 'particulier') {
    const brutoCent = Math.round((pro.brutoCent - basic.brutoCent) * ratio)
    const nettoCent = Math.round(brutoCent / (1 + BTW_PERCENTAGE / 100))
    return { brutoCent, btwCent: brutoCent - nettoCent, nettoCent }
  }
  const nettoCent = Math.round((pro.nettoCent - basic.nettoCent) * ratio)
  const btwCent = Math.round(nettoCent * (BTW_PERCENTAGE / 100))
  return { brutoCent: nettoCent + btwCent, btwCent, nettoCent }
}
