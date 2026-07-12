export type HealthBucket = 'risico' | 'neutraal' | 'gezond'

export const HEALTH_BUCKET_META: Record<HealthBucket, { label: string; color: string }> = {
  risico: { label: 'RISICO', color: '#cc4444' },
  neutraal: { label: 'NEUTRAAL', color: '#6b7280' },
  gezond: { label: 'GEZOND', color: '#44cc88' },
}

export interface HealthScoreInput {
  mindset_richting?: string | null
  systeem_richting?: string | null
  actie_richting?: string | null
  weinig_voortgang?: boolean | null
  stagnatie?: boolean | null
  laatsteCoachingGesprek?: string | null
  actieStatussenRecent: string[]
  laatsteSparring?: string | null
  coachingGesprekkenLaatste7Dagen: number
}

export interface HealthScoreResult {
  score: number
  bucket: HealthBucket
}

function dagenSinds(iso: string | null | undefined, nu: number): number {
  if (!iso) return Infinity
  return (nu - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
}

export function computeHealthScore(input: HealthScoreInput, nu: number = Date.now()): HealthScoreResult {
  let score = 50

  if (input.stagnatie) score -= 25
  else if (input.weinig_voortgang) score -= 10

  if (input.actie_richting === 'dalend') score -= 10
  if (input.systeem_richting === 'dalend') score -= 5
  if (input.mindset_richting === 'dalend') score -= 5

  if (dagenSinds(input.laatsteCoachingGesprek, nu) > 21) score -= 15

  const recent = input.actieStatussenRecent.slice(0, 5)
  const aantalNee = recent.filter(s => s === 'nee').length
  const aantalJa = recent.filter(s => s === 'ja').length
  if (aantalNee >= 3) score -= 15
  if (aantalJa >= 4) score += 10

  if (input.actie_richting === 'stijgend') score += 10
  if (input.systeem_richting === 'stijgend') score += 5
  if (input.mindset_richting === 'stijgend') score += 5

  if (dagenSinds(input.laatsteSparring, nu) <= 14) score += 5
  if (input.coachingGesprekkenLaatste7Dagen >= 2) score += 10

  score = Math.max(0, Math.min(100, score))
  const bucket: HealthBucket = score < 40 ? 'risico' : score > 70 ? 'gezond' : 'neutraal'
  return { score, bucket }
}
