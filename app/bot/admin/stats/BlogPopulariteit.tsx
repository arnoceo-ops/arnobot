'use client'

import { useMemo, useState } from 'react'

export interface BlogRij {
  slug: string
  title: string
  opens_period: number
  opens_total: number
  cta_period: number
  cta_total: number
}

const PAGE_SIZE = 10
const TOP = 5

const head = { fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', padding: '0 8px 8px', textAlign: 'left', borderBottom: '1px solid #374151' } as const
const headR = { ...head, textAlign: 'right' } as const
const cell = { fontFamily: 'sans-serif', fontSize: 14, color: '#f1f5f9', padding: '10px 8px', borderBottom: '1px solid #374151' } as const
const cellR = { ...cell, textAlign: 'right' } as const
const knop = { fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, fontWeight: 700, color: '#9ca3af', background: 'none', border: '1px solid #374151', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' } as const

type Periode = '30' | 'totaal'

// Populariteit per blog: de meest en minst geopende blogs, met een schakelaar tussen de laatste 30
// dagen en het totaal. De volledige lijst klapt open (10 per keer) en is te downloaden als CSV.
// Alle blogs komen in één keer mee vanaf de server (een kleine regel per blog), sorteren en
// uitklappen gebeurt in de browser.
export default function BlogPopulariteit({ rijen }: { rijen: BlogRij[] }) {
  const [periode, setPeriode] = useState<Periode>('30')
  const [alles, setAlles] = useState(false)
  const [zichtbaar, setZichtbaar] = useState(PAGE_SIZE)

  const opens = (r: BlogRij) => (periode === '30' ? r.opens_period : r.opens_total)
  const cta = (r: BlogRij) => (periode === '30' ? r.cta_period : r.cta_total)

  // Meest geopend eerst; bij gelijkstand de meeste klikken op Start gratis, dan op titel.
  const gesorteerd = useMemo(
    () => [...rijen].sort((a, b) => opens(b) - opens(a) || cta(b) - cta(a) || a.title.localeCompare(b.title)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rijen, periode]
  )

  const top = gesorteerd.slice(0, TOP)
  // Onderste lijst begint pas na de top, zodat bij weinig blogs niets dubbel in beide lijsten staat.
  const onder = gesorteerd.length > TOP ? gesorteerd.slice(Math.max(TOP, gesorteerd.length - TOP)).reverse() : []

  function Lijst({ titel, items }: { titel: string; items: BlogRij[] }) {
    return (
      <div>
        <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', marginBottom: 8 }}>{titel}</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={head}>BLOG</th>
              <th style={headR}>GEOPEND</th>
              <th style={headR}>START GRATIS</th>
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.slug}>
                <td style={cell}><a href={`/blog/${r.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: '#f1f5f9', textDecoration: 'none' }}>{r.title}</a></td>
                <td style={{ ...cellR, fontWeight: 700 }}>{opens(r)}</td>
                <td style={cellR}>{cta(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const periodeKnop = (p: Periode, tekst: string) => (
    <button
      type="button" onClick={() => { setPeriode(p); setZichtbaar(PAGE_SIZE) }}
      style={{ ...knop, color: periode === p ? '#111827' : '#9ca3af', background: periode === p ? '#f59e0b' : 'none', borderColor: periode === p ? '#f59e0b' : '#374151' }}
    >
      {tekst}
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {periodeKnop('30', '30 DAGEN')}
        {periodeKnop('totaal', 'TOTAAL')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32 }}>
        <Lijst titel="MEEST GEOPEND" items={top} />
        {onder.length > 0 && <Lijst titel="MINST GEOPEND" items={onder} />}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 24 }}>
        {rijen.length > TOP && (
          <button type="button" onClick={() => { setAlles(a => !a); setZichtbaar(PAGE_SIZE) }} style={knop}>
            {alles ? 'ALLE BLOGS VERBERGEN' : `ALLE BLOGS (${rijen.length})`}
          </button>
        )}
        <a href="/api/admin/blog/popularity-export" style={knop}>DOWNLOAD CSV</a>
      </div>

      {alles && (
        <div style={{ marginTop: 24 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={head}>#</th>
                  <th style={head}>BLOG</th>
                  <th style={headR}>GEOPEND</th>
                  <th style={headR}>START GRATIS</th>
                </tr>
              </thead>
              <tbody>
                {gesorteerd.slice(0, zichtbaar).map((r, i) => (
                  <tr key={r.slug}>
                    <td style={{ ...cell, color: '#6b7280' }}>{i + 1}</td>
                    <td style={cell}><a href={`/blog/${r.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: '#f1f5f9', textDecoration: 'none' }}>{r.title}</a></td>
                    <td style={{ ...cellR, fontWeight: 700 }}>{opens(r)}</td>
                    <td style={cellR}>{cta(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {zichtbaar < gesorteerd.length && (
            <p style={{ marginTop: 20 }}>
              <button type="button" onClick={() => setZichtbaar(v => v + PAGE_SIZE)} style={knop}>
                TOON DE VOLGENDE {Math.min(PAGE_SIZE, gesorteerd.length - zichtbaar)}
              </button>
              <span style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280', marginLeft: 12 }}>{zichtbaar} van {gesorteerd.length}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
