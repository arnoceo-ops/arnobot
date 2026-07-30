'use client'

import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_INPUTS, computeForN } from '@/lib/kostenTarieven'

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

// Zelfde stijlconstanten als KostenCalculatorClient.tsx (tab 1), bewust
// letterlijk gelijk gehouden zodat alle drie de tabbladen consistent ogen.
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
const statValue: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }
// Zelfde stijl als statValue, alleen amber: bewust geen eigen lineHeight, zodat
// de tekst exact op dezelfde baseline staat als de andere bedragen ernaast.
const headlineValueStyle: React.CSSProperties = { ...statValue, color: '#f59e0b' }
// Identiek aan numberInputStyle in KostenCalculatorClient.tsx
const numberInputStyle: React.CSSProperties = {
  width: 84, background: '#1f2937', border: '1.5px solid #2d3a4f', borderRadius: 6,
  color: '#f1f5f9', padding: '7px 10px', fontSize: 13.5, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}
const fieldLabelStyle: React.CSSProperties = { fontSize: 13.5, color: '#f1f5f9' }

function NumberField({ label, hint, value, onChange, step = 1 }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <div style={fieldLabelStyle}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{hint}</div>}
      </div>
      <input type="number" value={value} step={step} style={{ ...numberInputStyle, width: '100%' }} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  )
}

type Props = {
  prijzen: { basis: number; premium: number; elite: number }
  setPrijzen: (p: { basis: number; premium: number; elite: number }) => void
  nGebruikers: number
  setNGebruikers: (n: number) => void
}

export default function BusinessCaseClient({ prijzen, setPrijzen, nGebruikers, setNGebruikers }: Props) {
  const [geschiedenis, setGeschiedenis] = useState<Rij[]>([])
  const [live, setLive] = useState<LiveMaand | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [werkelijkInput, setWerkelijkInput] = useState<Record<string, string>>({})
  const [opslaan, setOpslaan] = useState<string | null>(null)

  // Verdeling per tier voor het scenario. Het totaal aantal gebruikers
  // (nGebruikers) is gedeeld met de Calculator (tab 1): instellen hier
  // beweegt tab 1 mee, en andersom, één en dezelfde waarde.
  const [scenarioPct, setScenarioPct] = useState({ basis: 58, premium: 40, elite: 2 })

  // Betaalprovider (Emirates NBD Pay / Network International): geen publiek
  // tarief, dit is een marktbenchmark voor internationaal uitgegeven kaarten
  // (3,2-3,9% + vast bedrag), niet een offerte. % creditcard staat nu op 100,
  // ruimte gelaten voor later: jaarbetalingen via factuur (geen kaartkosten)
  // tellen dan niet meer mee in dit percentage.
  const [betaalprovider, setBetaalprovider] = useState({ mdrPct: 3.5, mdrFixed: 0.25, pctCreditcard: 100 })

  function betaalproviderKosten(omzet: number, aantalTransacties: number): number {
    const aandeel = betaalprovider.pctCreditcard / 100
    return omzet * aandeel * (betaalprovider.mdrPct / 100) + aantalTransacties * aandeel * betaalprovider.mdrFixed
  }

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

  const scenario = useMemo(() => {
    const basisN = Math.round(nGebruikers * (scenarioPct.basis / 100))
    const premiumN = Math.round(nGebruikers * (scenarioPct.premium / 100))
    const eliteN = Math.round(nGebruikers * (scenarioPct.elite / 100))
    const omzet = basisN * prijzen.basis + premiumN * prijzen.premium + eliteN * prijzen.elite
    const kostenUsd = computeForN(DEFAULT_INPUTS, nGebruikers).totaal
    const kostenEur = kostenUsd / FX_EUR_USD
    const betaalKosten = betaalproviderKosten(omzet, basisN + premiumN + eliteN)
    return { basisN, premiumN, eliteN, omzet, kostenEur, betaalKosten }
  }, [nGebruikers, scenarioPct, prijzen, betaalprovider])

  const pctTotaal = scenarioPct.basis + scenarioPct.premium + scenarioPct.elite

  if (loading) return <p style={{ color: '#94a3b8', fontSize: 14 }}>Laden...</p>

  return (
    <div>
      {error && <p style={{ color: '#cc2200', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {live && (() => {
        const liveOmzet = (live.basis_gebruikers ?? 0) * prijzen.basis
          + (live.premium_gebruikers ?? 0) * prijzen.premium
          + (live.elite_gebruikers ?? 0) * prijzen.elite
        const liveAantal = (live.basis_gebruikers ?? 0) + (live.premium_gebruikers ?? 0) + (live.elite_gebruikers ?? 0)
        const liveBetaalKosten = betaalproviderKosten(liveOmzet, liveAantal)
        const liveKostenTotaal = live.prognose_kosten_eur + liveBetaalKosten
        return (
          <div style={{ ...cardStyle, background: 'linear-gradient(180deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))', border: '1px solid rgba(245,158,11,0.35)' }}>
            <div style={{ ...cardHeadStyle, color: '#f59e0b' }}><span style={dotStyle} />Lopende maand: {fmtMaand(live.maand)}</div>
            <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
              Live gemeten uit `approved_users`: {live.basis_gebruikers ?? 0} basis, {live.premium_gebruikers ?? 0} premium, {live.elite_gebruikers ?? 0} elite, {live.team_gebruikers ?? 0} Command (niet meegeteld in omzet, geen vlak tarief).
            </p>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                Basis €<input type="number" value={prijzen.basis} style={{ ...numberInputStyle, width: 70 }} onChange={e => setPrijzen({ ...prijzen, basis: parseFloat(e.target.value) || 0 })} />
              </label>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                Premium €<input type="number" value={prijzen.premium} style={{ ...numberInputStyle, width: 70 }} onChange={e => setPrijzen({ ...prijzen, premium: parseFloat(e.target.value) || 0 })} />
              </label>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                Elite €<input type="number" value={prijzen.elite} style={{ ...numberInputStyle, width: 70 }} onChange={e => setPrijzen({ ...prijzen, elite: parseFloat(e.target.value) || 0 })} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <div><div style={statLabel}>Omzet</div><div style={headlineValueStyle}>{fmtEUR(liveOmzet)}</div></div>
              <div><div style={statLabel}>Kosten AI/infra</div><div style={statValue}>{fmtEUR(live.prognose_kosten_eur)}</div></div>
              <div><div style={statLabel}>Betaalprovider</div><div style={statValue}>{fmtEUR(liveBetaalKosten)}</div></div>
              <div><div style={statLabel}>Winst</div><div style={statValue}>{fmtEUR(liveOmzet - liveKostenTotaal)}</div></div>
              <div><div style={statLabel}>Marge</div><div style={statValue}>{margePct(liveOmzet, liveKostenTotaal)}</div></div>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>
              Deze prijzen worden gebruikt zodra je de maand afsluit op het Trackrecord-tabblad, dus stel ze hier in vóórdat je afsluit.
            </p>
          </div>
        )
      })()}

      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Scenario: prognose bij schaal</div>
        <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 4 }}>
          Hypothetisch, los van de echte meting hierboven: kies een totaal aantal gebruikers en een verdeling over de tiers. Kosten komen uit dezelfde berekening als de Calculator (tab 1).
        </p>
        <NumberField label="Totaal aantal gebruikers" hint="gedeeld met de Calculator (tab 1)" value={nGebruikers} onChange={setNGebruikers} />
        <NumberField label="% Basis" value={scenarioPct.basis} onChange={v => setScenarioPct({ ...scenarioPct, basis: v })} />
        <NumberField label="% Premium" value={scenarioPct.premium} onChange={v => setScenarioPct({ ...scenarioPct, premium: v })} />
        <NumberField label="% Elite" value={scenarioPct.elite} onChange={v => setScenarioPct({ ...scenarioPct, elite: v })} />
        {pctTotaal !== 100 && (
          <p style={{ fontSize: 12, color: '#f59e0b', marginTop: 8 }}>Percentages tellen op tot {pctTotaal}%, niet 100%. De rest wordt als niet-betalend beschouwd.</p>
        )}
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 16 }}>
          <div>
            <div style={statLabel}>Verdeling</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>{scenario.basisN} basis &middot; {scenario.premiumN} premium &middot; {scenario.eliteN} elite</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 12 }}>
          <div><div style={statLabel}>Omzet</div><div style={headlineValueStyle}>{fmtEUR(scenario.omzet)}</div></div>
          <div><div style={statLabel}>Kosten AI/infra</div><div style={statValue}>{fmtEUR(scenario.kostenEur)}</div></div>
          <div><div style={statLabel}>Betaalprovider</div><div style={statValue}>{fmtEUR(scenario.betaalKosten)}</div></div>
          <div><div style={statLabel}>Winst</div><div style={statValue}>{fmtEUR(scenario.omzet - scenario.kostenEur - scenario.betaalKosten)}</div></div>
          <div><div style={statLabel}>Marge</div><div style={statValue}>{margePct(scenario.omzet, scenario.kostenEur + scenario.betaalKosten)}</div></div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Betaalprovider (Emirates NBD Pay)</div>
        <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 4 }}>
          Emirates NBD publiceert geen vast tarief voor kaartbetalingen, dit is een marktbenchmark voor internationaal uitgegeven kaarten (3,2-3,9% + vast bedrag per transactie), geen offerte. Vraag een echte offerte op zodra de bankrekening actief is.
        </p>
        <NumberField label="Tarief (%)" value={betaalprovider.mdrPct} step={0.1} onChange={v => setBetaalprovider({ ...betaalprovider, mdrPct: v })} />
        <NumberField label="Vast bedrag per transactie (€)" hint="≈ AED 1" value={betaalprovider.mdrFixed} step={0.01} onChange={v => setBetaalprovider({ ...betaalprovider, mdrFixed: v })} />
        <NumberField label="% van omzet via creditcard" hint="rest verondersteld via jaarfactuur, geen kaartkosten" value={betaalprovider.pctCreditcard} onChange={v => setBetaalprovider({ ...betaalprovider, pctCreditcard: v })} />
      </div>

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
                        style={{ ...numberInputStyle, width: 90 }}
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
