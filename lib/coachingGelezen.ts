// Is een coaching of SPE-analyse nog ongelezen? Ongelezen = er is een document en gelezen_op is leeg
// of ouder dan updated_at. De coachingpagina zet gelezen_op zodra het document zichtbaar is en er
// niet meer gegenereerd wordt (PATCH op /api/bot/coaching en /api/bot/team/zelfcoaching).
// Een eerste document zonder leesmoment (gelezen_op leeg) is dus ook ongelezen; bestaande
// documenten zijn bij de migratie van 2026-11-19 op gelezen gezet.

export function isOngelezen(
  updatedAt: string | null | undefined,
  gelezenOp: string | null | undefined,
): boolean {
  if (!updatedAt) return false
  const doc = new Date(updatedAt).getTime()
  if (Number.isNaN(doc)) return false
  if (!gelezenOp) return true
  const gelezen = new Date(gelezenOp).getTime()
  return Number.isNaN(gelezen) || gelezen < doc
}
