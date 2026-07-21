export function computeMsaScore(mindset: number, systeem: number, actie: number): number {
  return Math.max(1, Math.round((mindset + systeem + actie) / 15 * 100))
}
