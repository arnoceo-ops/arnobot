'use client'

export interface ScorePoint {
  mindset_score?: number | null
  systeem_score?: number | null
  actie_score?: number | null
  strategy_score?: number | null
  people_score?: number | null
  execution_score?: number | null
  created_at: string
}

export interface ChartSeries {
  key: keyof ScorePoint
  color: string
  label: string
}

export const MSA_SERIES: ChartSeries[] = [
  { key: 'mindset_score', color: '#f59e0b', label: 'MINDSET' },
  { key: 'systeem_score', color: '#60a5fa', label: 'SYSTEEM' },
  { key: 'actie_score',   color: '#34d399', label: 'ACTIE'   },
]

// Zelfde kleurhiërarchie als de SPE-pijlerbalken elders in de app: amber voor het gewogen
// zwaarste onderdeel (People), neutrale tinten voor de andere twee.
export const SPE_SERIES: ChartSeries[] = [
  { key: 'strategy_score',  color: '#60a5fa', label: 'STRATEGY'  },
  { key: 'people_score',    color: '#f59e0b', label: 'PEOPLE'    },
  { key: 'execution_score', color: '#34d399', label: 'EXECUTION' },
]

function curvePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i], mx = (p.x + c.x) / 2
    d += ` C ${mx} ${p.y} ${mx} ${c.y} ${c.x} ${c.y}`
  }
  return d
}

function maandNaam(yearMonth: string): string {
  return new Date(yearMonth + '-15').toLocaleDateString('nl-NL', { month: 'short' }).toUpperCase().replace('.', '')
}

interface MiniPoint { month: string; value: number }

function MiniChart({ points, label, color }: { points: MiniPoint[]; label: string; color: string }) {
  if (points.length === 0) return (
    <div style={{ background: '#1f2937', borderRadius: 4, padding: '16px 16px 12px 16px' }}>
      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, letterSpacing: 4, color: '#f1f5f9' }}>{label}</span>
      <div style={{ marginTop: 8, color: '#374151', fontFamily: "'Space Mono',monospace", fontSize: 13 }}>Geen data</div>
    </div>
  )

  const current = points[points.length - 1].value
  const W = 200, H = 84, PL = 20, PR = 4, PT = 6, PB = 20
  const iW = W - PL - PR, iH = H - PT - PB
  const n = points.length
  const xAt = (i: number) => n <= 1 ? PL + iW / 2 : PL + (i / (n - 1)) * iW
  const yAt = (v: number) => PT + (1 - (v - 1) / 4) * iH

  const pts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value) }))
  const line = curvePath(pts)
  const area = line
    ? line + ` L ${pts[pts.length - 1].x} ${PT + iH} L ${pts[0].x} ${PT + iH} Z`
    : ''
  const gradId = `mc-${label}`

  return (
    <div style={{ background: '#1f2937', borderRadius: 4, padding: '14px 14px 8px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span className="mc-label" style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, letterSpacing: 4, color: '#f1f5f9' }}>
          {label}
        </span>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 1, lineHeight: 1, color }}>
          {current.toFixed(1)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[1, 2, 3, 4, 5].map(v => (
          <g key={v}>
            <line x1={PL} y1={yAt(v)} x2={W - PR} y2={yAt(v)}
              stroke="#374151" strokeWidth="0.5"
              strokeDasharray={v === 1 || v === 5 ? undefined : '2 3'} />
            <text x={PL - 3} y={yAt(v) + 3.5} fill="#374151" fontSize="8"
              textAnchor="end" fontFamily="Space Mono, monospace">{v}</text>
          </g>
        ))}

        {area && <path d={area} fill={`url(#${gradId})`} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />}

        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === n - 1 ? 4.5 : 3.5}
            fill="#1f2937" stroke={color} strokeWidth={i === n - 1 ? 2 : 1.5} />
        ))}

        {points.map((p, i) => (
          <text key={i} x={xAt(i)} y={H - 3} fill="#6b7280" fontSize="9"
            textAnchor="middle" fontFamily="Space Mono, monospace">
            {p.month}
          </text>
        ))}
      </svg>
    </div>
  )
}

function avgScore(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
}

// series bewust optioneel met MSA als default: bestaande callsites (Teamscores, individuele
// coaching) blijven ongewijzigd werken, nieuwe callsites (SPE) geven series={SPE_SERIES} mee.
export function ProgressieChart({ history, series = MSA_SERIES }: { history: ScorePoint[]; series?: ChartSeries[] }) {
  const fourMonthsAgo = new Date()
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)

  const filtered = history.filter(h =>
    series.some(s => h[s.key] != null)
    && new Date(h.created_at) >= fourMonthsAgo
  )

  if (filtered.length === 0) return null

  // Groepeer per jaar-maand en bereken gemiddelde scores
  const byMonth = new Map<string, ScorePoint[]>()
  for (const h of filtered) {
    const key = h.created_at.slice(0, 7) // "2026-06"
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(h)
  }

  const monthly = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b)) // ASC op jaar-maand
    .map(([key, pts]) => {
      const row: Record<string, number | null | string> = { yearMonth: key }
      for (const s of series) row[s.key as string] = avgScore(pts.map(p => p[s.key] as number | null | undefined))
      return row
    })

  return (
    <>
      <style>{`
        .pg-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 560px) { .pg-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
      <div className="pg-grid">
        {series.map(s => {
          const points: MiniPoint[] = monthly
            .filter(m => m[s.key as string] != null)
            .map(m => ({
              month: maandNaam(m.yearMonth as string),
              value: m[s.key as string] as number,
            }))
          return <MiniChart key={s.key as string} points={points} label={s.label} color={s.color} />
        })}
      </div>
    </>
  )
}
