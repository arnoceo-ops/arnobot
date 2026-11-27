// Lukt een nieuwe coaching zeker? Eén regel voor de server (app/api/bot/coaching), de COACH ME-kaart
// op /bot en "Advies is actueel" op de coachingspagina. Zeker: nog geen advies, of minstens 3 nieuwe
// gesprekken en 48 uur sinds het vorige. Daaronder beslist de AI-controle op de server pas bij de
// klik, en die kan weigeren.
// Achtergrond: de kaart keek alleen of er iets nieuwer was dan het advies en bleef daardoor na een
// geweigerde klik staan (2026-11-27).

export const COACHING_MIN_NIEUWE_GESPREKKEN = 3
export const COACHING_MIN_UREN = 48
/** De server beoordeelt alleen de nieuwste gesprekken; de aanroepers tellen over dezelfde reeks. */
export const COACHING_MAX_GESPREKKEN = 50

export type VorigeCoaching = {
  updated_at?: string | null
  used_session_ids?: string[] | null
}

/** `sessieIds`: niet verwijderde, niet uitgesloten gesprekken van de gebruiker, nieuwste eerst. */
export function nieuweCoachingZeker(
  vorige: VorigeCoaching | null | undefined,
  sessieIds: string[],
  nu: number = Date.now(),
): boolean {
  if (!vorige) return true
  const uren = (nu - new Date(vorige.updated_at ?? 0).getTime()) / 3600000
  const gebruikt = new Set(vorige.used_session_ids ?? [])
  const nieuw = sessieIds.slice(0, COACHING_MAX_GESPREKKEN).filter(id => !gebruikt.has(id)).length
  return nieuw >= COACHING_MIN_NIEUWE_GESPREKKEN && uren >= COACHING_MIN_UREN
}
