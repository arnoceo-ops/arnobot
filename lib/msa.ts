export function computeMsaScore(mindset: number, systeem: number, actie: number): number {
  return Math.max(1, Math.round((mindset + systeem + actie) / 15 * 100))
}

// Strategy People Execution, gewogen 30/40/30 (People 40%, zie docs/TEAM_PLAN.md "Raamwerk:
// rollen x disciplines"), niet gelijk gewogen zoals computeMsaScore.
export function computeSpeScore(strategy: number, people: number, execution: number): number {
  const weighted = strategy * 0.3 + people * 0.4 + execution * 0.3
  return Math.max(1, Math.round(weighted / 5 * 100))
}
