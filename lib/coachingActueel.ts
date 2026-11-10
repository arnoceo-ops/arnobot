// Is het coachingsadvies nog actueel? Eén definitie voor de coachingspagina ("Advies is actueel")
// en de GROEIKANS-kaart op /bot. Actueel = het advies is nieuwer dan het laatste gesprek en de
// laatste analyse. Zonder advies (nog nooit gegenereerd) is het nooit actueel.
// Achtergrond: de kaart stelde COACH ME voor terwijl de coachingspagina zei dat alles actueel was,
// omdat de kaart alleen op tellers en de AI-classificatie leunde.

export function coachingIsActueel(
  coachingBijgewerkt: string | null | undefined,
  laatsteSessie: string | null | undefined,
  laatsteAnalyse: string | null | undefined,
): boolean {
  if (!coachingBijgewerkt) return false
  const doc = new Date(coachingBijgewerkt).getTime()
  if (Number.isNaN(doc)) return false
  const nieuwer = (d: string | null | undefined) => !!d && new Date(d).getTime() > doc
  return !nieuwer(laatsteSessie) && !nieuwer(laatsteAnalyse)
}
