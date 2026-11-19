// Omzet per gebruiker per kalendermaand voor de Abacus-tab Gebruikers, uit de betaaladministratie (arnobot_payments en arnobot_subscriptions).
// Netto, dus zonder btw, en een jaarbetaling gespreid over de 12 maanden vanaf de maand van betalen (besluit Arno 2026-11-19): anders staat
// €468 in één maand en nul in de elf daarna, en zegt de marge per maand niets. Een maandbetaling telt in de maand van betalen.
import { maandSleutel } from '@/lib/maandKosten'

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
