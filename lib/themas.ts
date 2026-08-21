// Vaste thema-taxonomie voor "De Spiegel" (team-module, punt 2A). Elke sessie wordt door
// session-end/route.ts geclassificeerd naar maximaal twee van deze labels, nooit vrije tekst.
// Vaste labels (i.p.v. vrije naamgeving zoals arnobot_memory_entities gebruikt) zijn nodig om
// teambreed betrouwbaar te kunnen tellen: "closing" en "afsluiten" zouden anders als twee losse
// thema's geteld worden in plaats van één.
export const THEMA_LABELS = [
  'PROSPECTING',
  'PIJPLIJNBEHEER',
  'BEZWAARHANTERING',
  'CLOSING',
  'KLANTRELATIE',
  'DEALSTRATEGIE',
  'MINDSET',
  'DISCIPLINE',
  'ONDERHANDELING',
  'TEAMSAMENWERKING',
] as const

export type ThemaLabel = typeof THEMA_LABELS[number]

export function parseThemas(raw: string): ThemaLabel[] {
  const text = raw.trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  try {
    const parsed = JSON.parse(start >= 0 && end >= 0 ? text.slice(start, end + 1) : '[]')
    if (!Array.isArray(parsed)) return []
    const labels = THEMA_LABELS as readonly string[]
    return parsed.filter((t): t is ThemaLabel => typeof t === 'string' && labels.includes(t)).slice(0, 2)
  } catch {
    return []
  }
}
