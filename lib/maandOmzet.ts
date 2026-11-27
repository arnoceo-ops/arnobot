// Omzet per gebruiker per kalendermaand voor de Abacus-tab Gebruikers, uit de betaaladministratie (arnobot_payments en arnobot_subscriptions).
// Netto, dus zonder btw, en een jaarbetaling gespreid over de 12 maanden vanaf de maand van betalen (besluit Arno 2026-11-19): anders staat
// €396 in één maand en nul in de elf daarna, en zegt de marge per maand niets. Een maandbetaling telt in de maand van betalen.
import { maandSleutel } from '@/lib/maandKosten'
import { dagenInMaand, dagenTussen } from '@/lib/amsterdamTijd'

export type BetalingVoorOmzet = {
  bedrag_cent: number
  btw_cent: number | null
  terugbetaald_cent: number | null
  betaald_at: string | null
  subscription_id: string | null
}
export type AboVoorOmzet = { id: string; cyclus: string }

function maandenTussen(van: string, tot: string): number {
  const [j1, m1] = van.split('-').map(Number)
  const [j2, m2] = tot.split('-').map(Number)
  return (j2 - j1) * 12 + (m2 - m1)
}

/**
 * Netto omzet in centen die een betaling bijdraagt aan de gevraagde maand ("JJJJ-MM", Amsterdamse tijd). Een terugbetaling gaat er pro rata
 * af (het teruggestorte bedrag is inclusief btw, dus eerst omgerekend naar dezelfde netto-verhouding).
 */
/**
 * Netto omzet in centen van één betaling over een periode van dagen ("JJJJ-MM-DD" tot en met "JJJJ-MM-DD", Amsterdamse kalenderdagen): per
 * kalendermaand die de periode raakt het maandbedrag, naar rato van het aantal dagen van die maand dat in de periode valt.
 */
export function nettoOmzetCentInPeriode(b: BetalingVoorOmzet, abo: AboVoorOmzet | undefined, van: string, tot: string): number {
  let som = 0
  let [jaar, maand] = van.split('-').map(Number)
  const [eindJaar, eindMaand] = tot.split('-').map(Number)
  while (jaar < eindJaar || (jaar === eindJaar && maand <= eindMaand)) {
    const sleutel = `${jaar}-${String(maand).padStart(2, '0')}`
    const lengte = dagenInMaand(jaar, maand)
    const eerste = `${sleutel}-01`
    const laatste = `${sleutel}-${String(lengte).padStart(2, '0')}`
    const dagenIn = dagenTussen(van > eerste ? van : eerste, tot < laatste ? tot : laatste)
    if (dagenIn > 0) som += nettoOmzetCentInMaand(b, abo, sleutel) * (dagenIn / lengte)
    maand++
    if (maand > 12) { maand = 1; jaar++ }
  }
  return som
}

export function nettoOmzetCentInMaand(b: BetalingVoorOmzet, abo: AboVoorOmzet | undefined, maand: string): number {
  if (!b.betaald_at || b.bedrag_cent <= 0) return 0
  const nettoVerhouding = (b.bedrag_cent - (b.btw_cent ?? 0)) / b.bedrag_cent
  const netto = Math.max(0, b.bedrag_cent - (b.terugbetaald_cent ?? 0)) * nettoVerhouding
  const startMaand = maandSleutel(new Date(b.betaald_at))
  if (abo?.cyclus === 'jaarlijks') {
    const idx = maandenTussen(startMaand, maand)
    return idx >= 0 && idx < 12 ? netto / 12 : 0
  }
  return startMaand === maand ? netto : 0
}
