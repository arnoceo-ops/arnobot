'use client'

import { useEffect, useState } from 'react'

type Meting = {
  maand: string
  gebruikers_count: number
  berichten_count: number
  analyses_count: number
  sparring_sessies_count: number
  sparring_berichten_count: number
  voice_interacties_count: number
  voice_tekens_count: number
  prognose_usd: number
  werkelijke_kosten_usd: number | null
  afgesloten_op: string | null
}

function fmtUSD(n: number | null): string {
  if (n === null || n === undefined) return '-'
  return '$' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMaand(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function afwijkingPct(prognose: number, werkelijk: number | null): string {
  if (werkelijk === null || werkelijk === undefined || prognose === 0) return '-'
  const pct = ((werkelijk - prognose) / prognose) * 100
  const teken = pct > 0 ? '+' : ''
  return `${teken}${pct.toFixed(1)}%`
}

const cardStyle: React.CSSProperties = {
  background: '#1a2333', border: '1px solid #2d3a4f', borderRadius: 12,
  padding: '20px 22px', marginBottom: 18,
}
const cardHeadStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: '#94a3b8', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
}
const dotStyle: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }

type Props = {
  prijzen: { basis: number; premium: number; elite: number }
}

export default function TrackrecordClient({ prijzen }: Props) {
  const [geschiedenis, setGeschiedenis] = useState<Meting[]>([])
  const [liveHuidigeMaand, setLiveHuidigeMaand] = useState<Meting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [afsluiten, setAfsluiten] = useState(false)
  const [werkelijkInput, setWerkelijkInput] = useState<Record<string, string>>({})
  const [opslaan, setOpslaan] = useState<string | null>(null)

  async function laadData() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/kosten-tracking')
      if (!res.ok) throw new Error('Ophalen mislukt')
      const data = await res.json()
      setGeschiedenis(data.geschiedenis ?? [])
      setLiveHuidigeMaand(data.liveHuidigeMaand ?? null)
    } catch {
      setError('Kon trackrecord niet laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { laadData() }, [])

  async function handleAfsluiten() {
    setAfsluiten(true)
    try {
      const res = await fetch('/api/kosten-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'afsluiten',
          prijsBasis: prijzen.basis,
          prijsPremium: prijzen.premium,
          prijsElite: prijzen.elite,
        }),
      })
      if (res.ok) await laadData()
      else setError('Afsluiten mislukt.')
    } catch {
      setError('Afsluiten mislukt.')
    } finally {
      setAfsluiten(false)
    }
  }

  async function handleWerkelijk(maand: string) {
    const bedrag = parseFloat(werkelijkInput[maand])
    if (isNaN(bedrag)) return
    setOpslaan(maand)
    try {
      const res = await fetch('/api/kosten-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'werkelijk', maand, werkelijkeKosten: bedrag }),
      })
      if (res.ok) await laadData()
      else setError('Opslaan mislukt.')
    } catch {
      setError('Opslaan mislukt.')
    } finally {
      setOpslaan(null)
    }
  }

  if (loading) return <p style={{ color: '#94a3b8', fontSize: 14 }}>Laden...</p>

  return (
    <div>
      {error && <p style={{ color: '#cc2200', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {liveHuidigeMaand && (
        <div style={{ ...cardStyle, background: 'linear-gradient(180deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))', border: '1px solid rgba(245,158,11,0.35)' }}>
          <div style={{ ...cardHeadStyle, color: '#f59e0b' }}><span style={dotStyle} />Lopende maand: {fmtMaand(liveHuidigeMaand.maand)}</div>
          <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>
            Live berekend uit echt gemeten gebruik tot nu toe deze maand: {liveHuidigeMaand.gebruikers_count} gebruikers, {liveHuidigeMaand.berichten_count} berichten, {liveHuidigeMaand.analyses_count} analyses, {liveHuidigeMaand.sparring_sessies_count} sparringsessies, {liveHuidigeMaand.voice_interacties_count} voice-interacties.
          </p>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', fontVariantNumeric: 'tabular-nums', marginBottom: 14 }}>
            {fmtUSD(liveHuidigeMaand.prognose_usd)}
          </div>
          <button
            onClick={handleAfsluiten}
            disabled={afsluiten}
            style={{
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              padding: '10px 20px', borderRadius: 999, border: 'none', cursor: afsluiten ? 'not-allowed' : 'pointer',
              background: afsluiten ? '#2d3a4f' : '#f59e0b', color: '#111827',
            }}
          >
            {afsluiten ? 'BEZIG...' : 'SLUIT DEZE MAAND AF'}
          </button>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>
            Zet de prognose voor {fmtMaand(liveHuidigeMaand.maand)} vast op het huidige (nog groeiende) gebruik. Doe dit pas aan het einde van de maand, of als je de rest van de maand wilt negeren.
          </p>
        </div>
      )}

      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Geschiedenis</div>
        {geschiedenis.length === 0 && (
          <p style={{ fontSize: 13, color: '#6b7280' }}>Nog geen afgesloten maanden.</p>
        )}
        {geschiedenis.map(rij => (
          <div key={rij.maand} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', textTransform: 'capitalize' }}>{fmtMaand(rij.maand)}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {rij.gebruikers_count} gebruikers &middot; {rij.berichten_count} berichten
              </span>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prognose</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(rij.prognose_usd)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Werkelijk</div>
                {rij.werkelijke_kosten_usd !== null ? (
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(rij.werkelijke_kosten_usd)}</div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="number"
                      placeholder="bedrag"
                      value={werkelijkInput[rij.maand] ?? ''}
                      onChange={e => setWerkelijkInput(prev => ({ ...prev, [rij.maand]: e.target.value }))}
                      style={{ width: 90, background: '#1f2937', border: '1.5px solid #2d3a4f', borderRadius: 6, color: '#f1f5f9', padding: '5px 8px', fontSize: 13 }}
                    />
                    <button
                      onClick={() => handleWerkelijk(rij.maand)}
                      disabled={opslaan === rij.maand}
                      style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#f59e0b', color: '#111827' }}
                    >
                      {opslaan === rij.maand ? '...' : 'OPSLAAN'}
                    </button>
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Afwijking</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: rij.werkelijke_kosten_usd === null ? '#6b7280' : '#f59e0b' }}>
                  {afwijkingPct(rij.prognose_usd, rij.werkelijke_kosten_usd)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
