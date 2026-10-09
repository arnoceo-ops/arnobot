import { SCENARIO_PRIJZEN } from '@/lib/kostenTarieven'

// De server berekent elk bedrag zelf uit dezelfde bron als /prijzen en Abacus
// (lib/kostenTarieven.ts). Een bedrag van de client wordt nooit vertrouwd.
//
// Btw (besloten 2026-10-10, zie docs/PAYMENTS_PLAN.md): alleen Nederland, 21%.
//  - Particulier betaalt het getoonde bedrag, de btw zit daar al in.
//  - Zakelijk betaalt het getoonde bedrag plus 21%.

export type Plan = 'basis' | 'premium'
export type Cyclus = 'maandelijks' | 'jaarlijks'
export type KlantType = 'particulier' | 'zakelijk'

export const BTW_PERCENTAGE = 21

export interface Bedrag {
  /** Wat de klant per betaling afrekent, inclusief btw. */
  brutoCent: number
  /** Het btw-deel daarvan. */
  btwCent: number
  /** Bruto min btw. */
  nettoCent: number
}

/** Getoond bedrag in hele euro's per betaling: maandbedrag, of het jaartotaal bij jaarlijks. */
export function getoondBedragEuro(plan: Plan, cyclus: Cyclus): number {
  if (plan === 'basis') return cyclus === 'maandelijks' ? SCENARIO_PRIJZEN.basicMaandelijks : SCENARIO_PRIJZEN.basicJaarlijksTotaal
  return cyclus === 'maandelijks' ? SCENARIO_PRIJZEN.proMaandelijks : SCENARIO_PRIJZEN.proJaarlijksTotaal
}

export function berekenBedrag(plan: Plan, cyclus: Cyclus, klantType: KlantType): Bedrag {
  const getoondCent = getoondBedragEuro(plan, cyclus) * 100
  if (klantType === 'particulier') {
    const nettoCent = Math.round(getoondCent / (1 + BTW_PERCENTAGE / 100))
    return { brutoCent: getoondCent, btwCent: getoondCent - nettoCent, nettoCent }
  }
  const btwCent = Math.round(getoondCent * (BTW_PERCENTAGE / 100))
  return { brutoCent: getoondCent + btwCent, btwCent, nettoCent: getoondCent }
}

export function planNaam(plan: Plan): string {
  return plan === 'premium' ? 'Pro' : 'Basic'
}

export function isPlan(v: unknown): v is Plan {
  return v === 'basis' || v === 'premium'
}
export function isCyclus(v: unknown): v is Cyclus {
  return v === 'maandelijks' || v === 'jaarlijks'
}
export function isKlantType(v: unknown): v is KlantType {
  return v === 'particulier' || v === 'zakelijk'
}
