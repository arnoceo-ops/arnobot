'use client'

import { useState } from 'react'

const label: React.CSSProperties = { display: 'block', fontSize: 12, letterSpacing: 1, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }
const input: React.CSSProperties = { fontSize: 14, padding: '6px 8px', borderRadius: 4, border: '1px solid #374151', background: '#111827', color: '#f1f5f9', width: '100%' }
const btn: React.CSSProperties = { fontSize: 12, letterSpacing: 1, fontWeight: 700, padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', background: '#f59e0b', color: '#111827' }

export interface TeamBillingInitial {
  teamId: string
  teamName: string
  minSeats: number | null
  cyclus: 'maandelijks' | 'jaarlijks' | null
  volgendeFactuurdatum: string | null
  geblokkeerdAt: string | null
  bedrijfsnaam: string | null
  kvkNummer: string | null
  btwNummer: string | null
  straat: string | null
  postcode: string | null
  plaats: string | null
}

export default function TeamBillingForm({ initial }: { initial: TeamBillingInitial }) {
  const [minSeats, setMinSeats] = useState(initial.minSeats?.toString() ?? '')
  const [cyclus, setCyclus] = useState(initial.cyclus ?? 'maandelijks')
  const [volgendeFactuurdatum, setVolgendeFactuurdatum] = useState(initial.volgendeFactuurdatum ?? '')
  const [bedrijfsnaam, setBedrijfsnaam] = useState(initial.bedrijfsnaam ?? '')
  const [kvkNummer, setKvkNummer] = useState(initial.kvkNummer ?? '')
  const [btwNummer, setBtwNummer] = useState(initial.btwNummer ?? '')
  const [straat, setStraat] = useState(initial.straat ?? '')
  const [postcode, setPostcode] = useState(initial.postcode ?? '')
  const [plaats, setPlaats] = useState(initial.plaats ?? '')
  const [status, setStatus] = useState<'idle' | 'bezig' | 'opgeslagen' | 'fout'>('idle')
  const [geblokkeerd, setGeblokkeerd] = useState(!!initial.geblokkeerdAt)

  async function opslaan() {
    setStatus('bezig')
    const res = await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: initial.teamId,
        minSeats: minSeats ? Number(minSeats) : null,
        cyclus,
        volgendeFactuurdatum: volgendeFactuurdatum || null,
        bedrijfsnaam, kvkNummer, btwNummer, straat, postcode, plaats,
      }),
    })
    setStatus(res.ok ? 'opgeslagen' : 'fout')
  }

  async function deblokkeer() {
    setStatus('bezig')
    const res = await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: initial.teamId, geblokkeerdAt: null }),
    })
    if (res.ok) setGeblokkeerd(false)
    setStatus(res.ok ? 'opgeslagen' : 'fout')
  }

  return (
    <div style={{ border: '1px solid #1f2937', borderRadius: 8, padding: 16, marginBottom: 16, background: '#0f172a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{initial.teamName}</span>
        {geblokkeerd && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, letterSpacing: 1, color: '#ef4444', fontWeight: 700 }}>GEBLOKKEERD</span>
            <button onClick={deblokkeer} style={{ ...btn, background: '#374151', color: '#f1f5f9' }}>DEBLOKKEER</button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label}>Min. seats</label>
          <input style={input} type="number" min={1} value={minSeats} onChange={e => setMinSeats(e.target.value)} placeholder="niet geactiveerd" />
        </div>
        <div>
          <label style={label}>Cyclus</label>
          <select style={input} value={cyclus} onChange={e => setCyclus(e.target.value as 'maandelijks' | 'jaarlijks')}>
            <option value="maandelijks">Maandelijks</option>
            <option value="jaarlijks">Jaarlijks</option>
          </select>
        </div>
        <div>
          <label style={label}>Volgende factuurdatum</label>
          <input style={input} type="date" value={volgendeFactuurdatum} onChange={e => setVolgendeFactuurdatum(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label}>Bedrijfsnaam</label>
          <input style={input} value={bedrijfsnaam} onChange={e => setBedrijfsnaam(e.target.value)} />
        </div>
        <div>
          <label style={label}>KvK-nummer</label>
          <input style={input} value={kvkNummer} onChange={e => setKvkNummer(e.target.value)} />
        </div>
        <div>
          <label style={label}>Btw-nummer</label>
          <input style={input} value={btwNummer} onChange={e => setBtwNummer(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label}>Straat</label>
          <input style={input} value={straat} onChange={e => setStraat(e.target.value)} />
        </div>
        <div>
          <label style={label}>Postcode</label>
          <input style={input} value={postcode} onChange={e => setPostcode(e.target.value)} />
        </div>
        <div>
          <label style={label}>Plaats</label>
          <input style={input} value={plaats} onChange={e => setPlaats(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={opslaan} disabled={status === 'bezig'} style={btn}>{status === 'bezig' ? 'BEZIG...' : 'OPSLAAN'}</button>
        {status === 'opgeslagen' && <span style={{ fontSize: 12, color: '#22c55e' }}>Opgeslagen</span>}
        {status === 'fout' && <span style={{ fontSize: 12, color: '#ef4444' }}>Mislukt</span>}
      </div>
    </div>
  )
}
