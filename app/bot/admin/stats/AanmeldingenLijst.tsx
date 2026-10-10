'use client'

import { useState } from 'react'

export interface Aanmelding {
  id: string
  email: string
  voornaam: string | null
  status: string
  created_at: string
}

const PAGE_SIZE = 50

const head = { fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, color: '#6b7280', padding: '0 8px 8px', textAlign: 'left', borderBottom: '1px solid #374151' } as const
const cell = { fontFamily: 'sans-serif', fontSize: 14, color: '#f1f5f9', padding: '10px 8px', borderBottom: '1px solid #374151' } as const
const knop = { fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, fontWeight: 700, color: '#9ca3af', background: 'none', border: '1px solid #374151', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' } as const

function statusLabel(status: string): string {
  return status === 'confirmed' ? 'BEVESTIGD' : status === 'pending' ? 'WACHT OP BEVESTIGING' : 'AFGEMELD'
}

// Lijst met aanmeldingen: de eerste 50 komen mee vanaf de server, de volgende 50 worden bij een klik
// opgehaald, zonder maximum. Plus een download van alle abonnees als CSV.
export default function AanmeldingenLijst({ initialRows, total }: { initialRows: Aanmelding[]; total: number }) {
  const [rows, setRows] = useState<Aanmelding[]>(initialRows)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function laadMeer() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/blog/subscribers?offset=${rows.length}&limit=${PAGE_SIZE}`)
      if (!res.ok) { setError('Ophalen mislukt'); return }
      const data = (await res.json()) as { rows: Aanmelding[] }
      // Dubbelen weren: een nieuwe aanmelding tussen twee klikken schuift de pagina's op.
      setRows(prev => {
        const bekend = new Set(prev.map(r => r.id))
        return [...prev, ...data.rows.filter(r => !bekend.has(r.id))]
      })
    } catch {
      setError('Ophalen mislukt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={head}>DATUM</th>
              <th style={head}>VOORNAAM</th>
              <th style={head}>E-MAIL</th>
              <th style={head}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id}>
                <td style={cell}>
                  {new Date(a.created_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}
                </td>
                <td style={cell}>{a.voornaam ?? ''}</td>
                <td style={cell}>{a.email}</td>
                <td style={{ ...cell, color: a.status === 'confirmed' ? '#f1f5f9' : '#6b7280' }}>{statusLabel(a.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 20 }}>
        {rows.length < total && (
          <button type="button" onClick={laadMeer} disabled={loading} style={{ ...knop, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'BEZIG...' : `TOON DE VOLGENDE ${Math.min(PAGE_SIZE, total - rows.length)}`}
          </button>
        )}
        <a href="/api/admin/blog/subscribers/export" style={knop}>DOWNLOAD CSV</a>
        <span style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#6b7280' }}>{rows.length} van {total}</span>
        {error && <span style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#f59e0b' }}>{error}</span>}
      </div>
    </div>
  )
}
