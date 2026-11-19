// Mag de teambaas nu een nieuwe SPE-analyse (Mijn leiderschap) laten maken? Eén definitie voor de
// server (POST /api/bot/team/zelfcoaching) en de LEIDERSCHAP-kaart op /bot, zodat de kaart nooit
// iets aanbiedt wat de server weigert (de MSA-coachingkaart liep daar eerder uit de pas, 2026-11-19).
//
// Regels: er moeten teamleden zijn; minimaal MIN_NIEUWE_1ON1S 1:1's in totaal; en met een eerdere
// analyse minimaal COOLDOWN_DAGEN sinds de laatste én MIN_NIEUWE_1ON1S nieuwe 1:1's (id's die
// nog niet in used_1on1_ids van die analyse staan).

export const COOLDOWN_DAGEN = 14
export const MIN_NIEUWE_1ON1S = 3

export type SpeAnalyseStatus =
  | { mogelijk: true; totaal: number; nieuw: number; eerdereAnalyse: boolean }
  | { mogelijk: false; reden: 'geen_teamleden' }
  | { mogelijk: false; reden: 'te_weinig'; totaal: number }
  | { mogelijk: false; reden: 'te_vroeg'; totaal: number; nieuw: number; dagenResterend: number }

export function speAnalyseStatus(input: {
  heeftTeamleden: boolean
  logIds: string[]
  vorige: { updatedAt: string; usedIds: string[] } | null
  nu?: number
}): SpeAnalyseStatus {
  const { heeftTeamleden, logIds, vorige } = input
  if (!heeftTeamleden) return { mogelijk: false, reden: 'geen_teamleden' }
  const totaal = logIds.length
  if (totaal < MIN_NIEUWE_1ON1S) return { mogelijk: false, reden: 'te_weinig', totaal }
  if (!vorige) return { mogelijk: true, totaal, nieuw: totaal, eerdereAnalyse: false }
  const gebruikt = new Set(vorige.usedIds)
  const nieuw = logIds.filter(id => !gebruikt.has(id)).length
  const dagen = ((input.nu ?? Date.now()) - new Date(vorige.updatedAt).getTime()) / 86400000
  if (dagen < COOLDOWN_DAGEN || nieuw < MIN_NIEUWE_1ON1S) {
    return { mogelijk: false, reden: 'te_vroeg', totaal, nieuw, dagenResterend: Math.max(0, Math.ceil(COOLDOWN_DAGEN - dagen)) }
  }
  return { mogelijk: true, totaal, nieuw, eerdereAnalyse: true }
}
