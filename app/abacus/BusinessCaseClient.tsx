'use client'

import { useMemo, useState } from 'react'
import {
  DEFAULT_INPUTS, computeForN, berekenOmzetEnBetaalprovider,
  type Prijzen, type TierVerdeling, type Betaalprovider,
} from '@/lib/kostenTarieven'

const FX_EUR_USD = 1.08

function fmtEUR(n: number | null): string {
  if (n === null || n === undefined) return '-'
  return '€' + n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
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

function NumberField({ label, hint, value, onChange, step = 1, large = false }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number; large?: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <div style={fieldLabelStyle}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{hint}</div>}
      </div>
      <input
        type="number"
        value={value}
        step={step}
        style={{ ...numberInputStyle, width: '100%', ...(large ? { fontSize: 22, fontWeight: 700 } : {}) }}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  )
}

type Props = {
  prijzen: Prijzen
  setPrijzen: (p: Prijzen) => void
  nGebruikers: number
  setNGebruikers: (n: number) => void
  tierVerdeling: TierVerdeling
  setTierVerdeling: (v: TierVerdeling) => void
  betaalprovider: Betaalprovider
  setBetaalprovider: (b: Betaalprovider) => void
}

export default function BusinessCaseClient({
  prijzen, setPrijzen, nGebruikers, setNGebruikers,
  tierVerdeling: scenarioPct, setTierVerdeling: setScenarioPct,
  betaalprovider, setBetaalprovider,
}: Props) {
  const scenario = useMemo(() => {
    const { basisN, premiumN, eliteN, omzet, betaalproviderKosten: betaalKosten } =
      berekenOmzetEnBetaalprovider(prijzen, scenarioPct, betaalprovider, nGebruikers)
    const kostenUsd = computeForN(DEFAULT_INPUTS, nGebruikers).totaal
    const kostenEur = kostenUsd / FX_EUR_USD
    return { basisN, premiumN, eliteN, omzet, kostenEur, betaalKosten }
  }, [nGebruikers, scenarioPct, prijzen, betaalprovider])

  const pctTotaal = scenarioPct.basis + scenarioPct.premium + scenarioPct.elite

  return (
    <div>
      <div style={cardStyle}>
        <div style={cardHeadStyle}><span style={dotStyle} />Scenario: prognose bij schaal</div>
        <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 4 }}>
          Hypothetisch, los van echte meting: kies een totaal aantal gebruikers en een verdeling over de tiers. Kosten komen uit dezelfde berekening als de Calculator (tab 1).
        </p>
        <NumberField label="Totaal aantal gebruikers" hint="gedeeld met de Calculator (tab 1)" value={nGebruikers} onChange={setNGebruikers} />
        <NumberField label="Tarief Basis (€)" hint="wordt ook gebruikt bij het afsluiten van een maand op Trackrecord" value={prijzen.basis} onChange={v => setPrijzen({ ...prijzen, basis: v })} large />
        <NumberField label="Tarief Premium (€)" hint="wordt ook gebruikt bij het afsluiten van een maand op Trackrecord" value={prijzen.premium} onChange={v => setPrijzen({ ...prijzen, premium: v })} large />
        <NumberField label="Tarief Elite (€)" hint="wordt ook gebruikt bij het afsluiten van een maand op Trackrecord" value={prijzen.elite} onChange={v => setPrijzen({ ...prijzen, elite: v })} large />
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
        <NumberField label="% van omzet via creditcard" hint="rest verondersteld via jaarfactuur of Command Team Subscription, geen kaartkosten" value={betaalprovider.pctCreditcard} onChange={v => setBetaalprovider({ ...betaalprovider, pctCreditcard: v })} />
      </div>
    </div>
  )
}
