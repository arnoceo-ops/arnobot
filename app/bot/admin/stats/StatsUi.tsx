// Gedeelde onderdelen van de statistiekenpagina (/bot/admin/stats) en haar tabbladen.
// Eén tegel-component voor alle content, zie de admin dashboard-norm in CLAUDE.md.

// Universele tegel: elk blok op de pagina (statlijst, splitbar, ratiobars, trend) krijgt
// dezelfde kaart-vormgeving, zodat het als één samenhangend dashboard oogt i.p.v. een
// mengelmoes van losse doosjes. `span` laat een tegel 2 kolommen innemen in de grid
// hieronder, voor content die meer breedte nodig heeft (trends, meerdere ratiobalken).
export function StatCard({ label, span, full, stats = [], footnote, children }: {
  label: string
  span?: number
  full?: boolean
  stats?: { sublabel: string; value: string; warn?: boolean; note?: string }[]
  footnote?: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ background: '#1f2937', borderRadius: 4, padding: 20, gridColumn: full ? '1 / -1' : span ? `span ${span}` : undefined }}>
      <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#f59e0b', marginBottom: 16 }}>{label}</p>
      {stats.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: children ? 16 : 0 }}>
          {stats.map(s => (
            <div key={s.sublabel}>
              <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', marginBottom: 2 }}>{s.sublabel}</p>
              <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: s.warn ? '#f59e0b' : '#f1f5f9', lineHeight: 1 }}>{s.value}</p>
              {s.note && <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.note}</p>}
            </div>
          ))}
        </div>
      )}
      {children}
      {footnote && <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', marginTop: 16 }}>{footnote}</p>}
    </div>
  )
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'stretch' }}>
      {children}
    </div>
  )
}

export function SubHeading({ label }: { label: string }) {
  return (
    <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', margin: '32px 0 16px' }}>{label}</p>
  )
}

// Trechter: elke stap als balk t.o.v. de grootste bekende stap, met een los toelichtend
// getal per stap (percentage van de vorige stap, of een kanttekening als de stap nog geen
// echte data heeft). Bewust geen % voor de eerste stap, die heeft geen "vorige stap".
export function FunnelBar({ label, value, max, note }: { label: string; value: number; max: number; note?: string }) {
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', letterSpacing: 1, minWidth: 130, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: '#111827', borderRadius: 2, height: 20 }}>
        <div style={{ width: `${width}%`, background: '#f59e0b', borderRadius: 2, height: '100%' }} />
      </div>
      <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, color: '#f1f5f9', minWidth: 36, textAlign: 'right' }}>{value}</span>
      <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', minWidth: 150, textAlign: 'right', flexShrink: 0 }}>{note ?? ''}</span>
    </div>
  )
}

export function HeroStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#6b7280', marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 44, color: '#f1f5f9', lineHeight: 1 }}>{value}</p>
      {note && <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', marginTop: 4 }}>{note}</p>}
    </div>
  )
}

export function SplitBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  return (
    <div>
      <div style={{ display: 'flex', height: 16, borderRadius: 2, overflow: 'hidden', background: '#111827' }}>
        {segments.map(s => (
          <div key={s.label} style={{ width: total > 0 ? `${(s.value / total) * 100}%` : '0%', background: s.color }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 1, color: '#9ca3af' }}>{s.label} {s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RatioBar({ label, ratio, note }: { label: string; ratio: number; note?: string }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', letterSpacing: 1, minWidth: 80, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: '#111827', borderRadius: 2, height: 16, position: 'relative' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, ratio))}%`, background: '#f59e0b', borderRadius: 2, height: '100%' }} />
      </div>
      <span style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 700, color: '#f1f5f9', minWidth: 90, textAlign: 'right' }}>
        {ratio}%{note && <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280' }}> ({note})</span>}
      </span>
    </div>
  )
}

export function TrendChart({ data, limit = 6 }: { data: Record<string, number>; limit?: number }) {
  const maanden = Object.keys(data).sort().slice(-limit).reverse()
  if (maanden.length === 0) {
    return <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280' }}>Nog geen data.</p>
  }
  const max = Math.max(...maanden.map(m => data[m]))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {maanden.map(m => (
        <div key={m} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b7280', letterSpacing: 1, minWidth: 60, flexShrink: 0 }}>{m}</span>
          <div style={{ flex: 1, background: '#111827', borderRadius: 2, height: 16, position: 'relative' }}>
            <div style={{
              width: `${Math.max(4, (data[m] / max) * 100)}%`,
              background: '#f59e0b', borderRadius: 2, height: '100%',
            }} />
          </div>
          <span style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 700, color: '#f1f5f9', minWidth: 24, textAlign: 'right' }}>{data[m]}</span>
        </div>
      ))}
    </div>
  )
}
