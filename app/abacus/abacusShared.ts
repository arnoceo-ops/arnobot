import type React from 'react'

// Gedeelde stijlconstanten en formatters voor de Abacus-tabbladen. Zelfde
// stijl als KostenCalculatorClient.tsx (tab 1), bewust letterlijk gelijk
// gehouden zodat alle drie de tabbladen consistent ogen.
export const cardStyle: React.CSSProperties = {
  background: '#1a2333', border: '1px solid #2d3a4f', borderRadius: 12,
  padding: '20px 22px', marginBottom: 18,
}
export const cardHeadStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: '#94a3b8', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
}
export const dotStyle: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }
export const statLabel: React.CSSProperties = { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }
export const statValue: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }
// Zelfde stijl als statValue, alleen amber: bewust geen eigen lineHeight, zodat
// de tekst exact op dezelfde baseline staat als de andere bedragen ernaast.
export const headlineValueStyle: React.CSSProperties = { ...statValue, color: '#f59e0b' }
export const statCellStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '10px 14px', textAlign: 'right', minHeight: 64,
}

export function fmtEUR(n: number | null): string {
  if (n === null || n === undefined) return '-'
  const sign = n < 0 ? '-' : ''
  return sign + '€ ' + Math.abs(n).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
