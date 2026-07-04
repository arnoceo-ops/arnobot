'use client'

export interface ScorePoint {
  mindset_score: number | null
  systeem_score: number | null
  actie_score: number | null
  created_at: string
}

const SERIES = [
  { key: 'mindset_score' as keyof ScorePoint, color: '#f59e0b', label: 'MINDSET', offset: -1.5 },
  { key: 'systeem_score' as keyof ScorePoint, color: '#60a5fa', label: 'SYSTEEM', offset: 0 },
  { key: 'actie_score'   as keyof ScorePoint, color: '#34d399', label: 'ACTIE',   offset: 1.5 },
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

export function ProgressieChart({ history }: { history: ScorePoint[] }) {
  const data = [...history]
    .filter(h => h.mindset_score != null || h.systeem_score != null || h.actie_score != null)

  if (data.length === 0) return null

  const W = 600, H = 200, PL = 28, PR = 12, PT = 34, PB = 32
  const iW = W - PL - PR, iH = H - PT - PB
  const n = data.length
  const xAt = (i: number) => n === 1 ? PL + iW / 2 : PL + (i / (n - 1)) * iW
  const yAt = (v: number, offset = 0) => PT + (1 - (v - 1) / 4) * iH + offset

  const activeSeries = SERIES.filter(s => data.some(d => d[s.key] != null))

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        {activeSeries.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="24" height="10" style={{ display: 'block', flexShrink: 0 }}>
              <line x1="0" y1="5" x2="24" y2="5" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="5" r="3" fill="#111827" stroke={s.color} strokeWidth="2" />
            </svg>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 3, color: '#6b7280' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <defs>
          {activeSeries.map(s => (
            <linearGradient key={s.key} id={`pg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.14" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {[1, 2, 3, 4, 5].map(v => (
          <g key={v}>
            <line x1={PL} y1={yAt(v)} x2={W - PR} y2={yAt(v)}
              stroke="#374151" strokeWidth="0.5"
              strokeDasharray={v === 1 || v === 5 ? undefined : '3 4'} />
            <text x={PL - 6} y={yAt(v) + 4} fill="#374151" fontSize="10"
              textAnchor="end" fontFamily="Space Mono, monospace">{v}</text>
          </g>
        ))}

        {/* Pass 1: fills — laagste laag */}
        {activeSeries.map(s => {
          const pts = data
            .map((d, i) => d[s.key] != null ? { x: xAt(i), y: yAt(d[s.key] as number, s.offset) } : null)
            .filter((p): p is { x: number; y: number } => p != null)
          const lp = curvePath(pts)
          if (!lp) return null
          const base = PT + iH
          const ap = lp + ` L ${pts[pts.length - 1].x} ${base} L ${pts[0].x} ${base} Z`
          return <path key={s.key} d={ap} fill={`url(#pg-${s.key})`} />
        })}

        {/* Pass 2: lijnen — midden laag */}
        {activeSeries.map(s => {
          const pts = data
            .map((d, i) => d[s.key] != null ? { x: xAt(i), y: yAt(d[s.key] as number, s.offset) } : null)
            .filter((p): p is { x: number; y: number } => p != null)
          const lp = curvePath(pts)
          return lp ? (
            <path key={s.key} d={lp} fill="none" stroke={s.color} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          ) : null
        })}

        {/* Pass 3: punten + waarden — bovenste laag */}
        {activeSeries.map(s => (
          <g key={s.key}>
            {data.map((d, i) => {
              if (d[s.key] == null) return null
              const x = xAt(i), y = yAt(d[s.key] as number, s.offset)
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="9" fill={s.color} opacity="0.08" />
                  <circle cx={x} cy={y} r="4.5" fill="#111827" stroke={s.color} strokeWidth="2" />
                  <text x={x} y={y - 12} fill={s.color} fontSize="14"
                    textAnchor="middle" fontFamily="Bebas Neue, sans-serif" letterSpacing="1">
                    {d[s.key]}
                  </text>
                </g>
              )
            })}
          </g>
        ))}

        {data.map((d, i) => (
          <text key={i} x={xAt(i)} y={H - 6} fill="#4b5563" fontSize="11"
            textAnchor="middle" fontFamily="Space Mono, monospace">
            {new Date(d.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }).toUpperCase()}
          </text>
        ))}
      </svg>
    </div>
  )
}
