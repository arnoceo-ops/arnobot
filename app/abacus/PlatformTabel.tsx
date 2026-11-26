'use client'

import { SorteerKop, useSortering } from './sorteerTabel'

// Gemeten AI-kosten zonder gebruiker (crons, admin), per bron. Staat op de tab Trackrecord.
export type PlatformRij = { bron: string; usd: number; aanroepen: number }

type Kolom = 'bron' | 'aanroepen' | 'dollars'

const th: React.CSSProperties = { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #2d3a4f' }
const td: React.CSSProperties = { fontSize: 13.5, padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #222d3f' }
const fmtUsd3 = (n: number) => '$' + n.toLocaleString('nl-NL', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export default function PlatformTabel({ rijen }: { rijen: PlatformRij[] }) {
  const { sortering, klik, sorteer } = useSortering<Kolom>()
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <SorteerKop kolom="bron" label="Bron" tekst stijl={th} sortering={sortering} onKlik={klik} />
          <SorteerKop kolom="aanroepen" label="Aanroepen" stijl={th} sortering={sortering} onKlik={klik} />
          <SorteerKop kolom="dollars" label="Dollars" stijl={th} sortering={sortering} onKlik={klik} />
        </tr>
      </thead>
      <tbody>
        {sorteer(rijen, { bron: r => r.bron, aanroepen: r => r.aanroepen, dollars: r => r.usd }).map(r => (
          <tr key={r.bron}>
            <td style={{ ...td, textAlign: 'left' }}>{r.bron}</td>
            <td style={td}>{r.aanroepen}</td>
            <td style={td}>{fmtUsd3(r.usd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
