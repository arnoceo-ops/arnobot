'use client'

import { useEffect, useState } from 'react'

type Rij = {
  maand: string
  basis_gebruikers: number | null
  premium_gebruikers: number | null
  elite_gebruikers: number | null
  team_gebruikers: number | null
  prognose_omzet_eur: number | null
  werkelijke_omzet_eur: number | null
  prognose_usd: number
  werkelijke_kosten_usd: number | null
}

type LiveMaand = Rij & { prognose_kosten_eur: number }

const FX_EUR_USD = 1.08

function fmtEUR(n: number | null): string {
  if (n === null || n === undefined) return '-'
  return '€' + n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtMaand(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function margePct(omzet: number | null, kosten: number | null): string {
  if (omzet === null || omzet === undefined || !omzet || kosten === null || kosten === undefined) return '-'
  return `${(((omzet - kosten) / omzet) * 100).toFixed(0)}%`
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
const statLabel: React.CSSProperties = { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }
const statValue: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }
const priceInputStyle: React.CSSProperties = {
  width: 70, background: '#1f2937', border: '1.5px solid #2d3a4f', borderRadius: 6,
  color: '#f1f5f9', padding: '5px 8px', fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
}

type Props = {
  prijzen: { basis: number; premium: number; elite: number }
  setPrijzen: (p: { basis: number; premium: number; elite: number }) => void
}

export default function BusinessCaseClient({ prijzen, setPrijzen }: Props) {
  const [geschiedenis, setGeschiedenis] = useState<Rij[]>([])
  const [live, setLive] = useState<LiveMaand | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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
      setLive(data.liveHuidigeMaand ?? null)
    } catch {
      setError('Kon business case niet laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { laadData() }, [])

  async function handleWerkelijkOmzet(maand: string) {
    const bedrag = parseFloat(werkelijkInput[maand])
    if (isNaN(bedrag)) return
    setOpslaan(maand)
    try {
      const res = await fetch('/api/kosten-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'werkelijkOmzet', maand, werkelijkeOmzet: bedrag }),
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

      {live && (() => {
        const liveOmzet = (live.basis_gebruikers ?? 0) * prijzen.basis
          + (live.premium_gebruikers ?? 0) * prijzen.premium
          + (live.elite_gebruikers ?? 0) * prijzen.elite
        return (
          <div style={{ ...cardStyle, background: 'linear-gradient(180deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))', border: '1px solid rgba(245,158,11,0.35)' }}>
            <div style={{ ...cardHeadStyle, color: '#f59e0b' }}><span style={dotStyle} />Lopende maand: {fmtMaand(live.maand)}</div>
            <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
              Live gemeten uit `approved_users`: {live.basis_gebruikers ?? 0} basis, {live.premium_gebruikers ?? 0} premium, {live.elite_gebruikers ?? 0} elite, {live.team_gebruikers ?? 0} Command (niet meegeteld in omzet, geen vlak tarief).
            </p>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                Basis €<input type="number" value={prijzen.basis} style={priceInputStyle} onChange={e => setPrijzen({ ...prijzen, basis: parseFloat(e.target.value) || 0 })} />
              </label>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                Premium €<input type="number" value={prijzen.premium} style={priceInputStyle} onChange={e => setPrijzen({ ...prijzen, premium: parseFloat(e.target.value) || 0 })} />
              </label>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                Elite €<input type="number" value={prijzen.elite} style={priceInputStyle} onChange={e => setPrijzen({ ...prijzen, elite: parseFloat(e.target.value) || 0 })} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <div><div style={statLabel}>Omzet</div><div style={{ ...statValue, fontSize: 22, color: '#f59e0b' }}>{fmtEUR(liveOmzet)}</div></div>
              <div><div style={statLabel}>Kosten</div><div style={statValue}>{fmtEUR(live.prognose_kosten_eur)}</div></div>
              <div><div style={statLabel}>Winst</div><div style={statValue}>{fmtEUR(liveOmzet - live.prognose_kosten_eur)}</div></div>
              <div><div style={statLabel}>Marge</div><div style={statValue}>{margePct(liveOmzet, live.prognose_kosten_eur)}</div></div>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>
              Deze prijzen worden gebruikt zodra je de maand afsluit op het Trackrecord-tabblad, dus stel ze hier in vóórdat je afsluit.
            </p>
          </div>
        )
      })()}

      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Geschiedenis</div>
        {geschiedenis.length === 0 && (
          <p style={{ fontSize: 13, color: '#6b7280' }}>Nog geen afgesloten maanden.</p>
        )}
        {geschiedenis.map(rij => {
          const kostenEur = rij.prognose_usd / FX_EUR_USD
          return (
            <div key={rij.maand} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', textTransform: 'capitalize' }}>{fmtMaand(rij.maand)}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  {rij.basis_gebruikers ?? 0} basis &middot; {rij.premium_gebruikers ?? 0} premium &middot; {rij.elite_gebruikers ?? 0} elite
                </span>
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={statLabel}>Omzet (prognose)</div>
                  <div style={statValue}>{fmtEUR(rij.prognose_omzet_eur)}</div>
                </div>
                <div>
                  <div style={statLabel}>Kosten (prognose)</div>
                  <div style={statValue}>{fmtEUR(kostenEur)}</div>
                </div>
                <div>
                  <div style={statLabel}>Winst (prognose)</div>
                  <div style={statValue}>{fmtEUR((rij.prognose_omzet_eur ?? 0) - kostenEur)}</div>
                </div>
                <div>
                  <div style={statLabel}>Marge (prognose)</div>
                  <div style={statValue}>{margePct(rij.prognose_omzet_eur, kostenEur)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <div style={statLabel}>Omzet (werkelijk)</div>
                  {rij.werkelijke_omzet_eur !== null ? (
                    <div style={statValue}>{fmtEUR(rij.werkelijke_omzet_eur)}</div>
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
                        onClick={() => handleWerkelijkOmzet(rij.maand)}
                        disabled={opslaan === rij.maand}
                        style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#f59e0b', color: '#111827' }}
                      >
                        {opslaan === rij.maand ? '...' : 'OPSLAAN'}
                      </button>
                    </div>
                  )}
                </div>
                {rij.werkelijke_kosten_usd !== null && (
                  <div>
                    <div style={statLabel}>Kosten (werkelijk)</div>
                    <div style={statValue}>{fmtEUR(rij.werkelijke_kosten_usd / FX_EUR_USD)}</div>
                  </div>
                )}
                {rij.werkelijke_omzet_eur !== null && rij.werkelijke_kosten_usd !== null && (
                  <>
                    <div>
                      <div style={statLabel}>Winst (werkelijk)</div>
                      <div style={{ ...statValue, color: '#f59e0b' }}>{fmtEUR(rij.werkelijke_omzet_eur - rij.werkelijke_kosten_usd / FX_EUR_USD)}</div>
                    </div>
                    <div>
                      <div style={statLabel}>Marge (werkelijk)</div>
                      <div style={{ ...statValue, color: '#f59e0b' }}>{margePct(rij.werkelijke_omzet_eur, rij.werkelijke_kosten_usd / FX_EUR_USD)}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
