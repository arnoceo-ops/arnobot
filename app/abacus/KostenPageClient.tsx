'use client'

import { useState } from 'react'
import KostenCalculatorClient from './KostenCalculatorClient'
import TrackrecordClient from './TrackrecordClient'
import BusinessCaseClient from './BusinessCaseClient'
import { DEFAULT_TIER_VERDELING, DEFAULT_BILLING_SPLIT, DEFAULT_BETAALPROVIDER, DEFAULT_TEAM_SCENARIO } from '@/lib/kostenTarieven'

type Tab = 'calculator' | 'trackrecord' | 'businesscase'

const TABS: { id: Tab; label: string }[] = [
  { id: 'calculator', label: 'Calculator' },
  { id: 'trackrecord', label: 'Trackrecord' },
  { id: 'businesscase', label: 'Business case' },
]

export default function KostenPageClient() {
  const [tab, setTab] = useState<Tab>('calculator')
  // Gedeeld tussen Calculator (tab 1) en het Scenario-blok op Business case
  // (tab 3): één en dezelfde waarde, instellen op de ene tab beweegt de
  // andere automatisch mee, in beide richtingen.
  const [nGebruikers, setNGebruikers] = useState(250)
  // %-verdeling per tier (Basic/Pro) en %-betaalcyclus per tier: gedeeld,
  // zodat tab 1 (Calculator) de betaalprovider-kosten als onderdeel van de
  // totale kosten kan tonen, i.p.v. dat die alleen op tab 3 zichtbaar is.
  // Zowel de échte live Basis/Premium/Elite-prijs (Trackrecord, DEFAULT_PRIJZEN)
  // als de Basic/Pro-scenariotarieven (SCENARIO_PRIJZEN) zijn definitief vast
  // (besloten 2026-07-31), geen state meer, direct uit lib/kostenTarieven.ts
  // geïmporteerd waar nodig.
  const [tierVerdeling, setTierVerdeling] = useState(DEFAULT_TIER_VERDELING)
  const [billingSplit, setBillingSplit] = useState(DEFAULT_BILLING_SPLIT)
  const [betaalprovider, setBetaalprovider] = useState(DEFAULT_BETAALPROVIDER)
  // Team staat los van tierVerdeling (zie TeamScenario in lib/kostenTarieven.ts),
  // zelfde gedeeld-tussen-tab-1-en-3-patroon als hierboven.
  const [teamScenario, setTeamScenario] = useState(DEFAULT_TEAM_SCENARIO)
  // Tweede wachtwoord voor schrijfacties (maand afsluiten, werkelijke cijfers
  // invullen). Eén keer intypen per sessie, gedeeld tussen Trackrecord en
  // Business case, verder alleen in geheugen (niet opgeslagen).
  const [schrijfWachtwoord, setSchrijfWachtwoord] = useState('')

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #111827; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 14px; }
      `}</style>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(28px,4vw,48px) clamp(16px,3vw,32px) 0' }}>
        <div style={{ display: 'inline-flex', background: '#1a2333', border: '1px solid #2d3a4f', borderRadius: 999, padding: 3, marginBottom: 8 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '8px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: tab === t.id ? '#f59e0b' : 'transparent',
                color: tab === t.id ? '#111827' : '#94a3b8',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'calculator' && (
        <KostenCalculatorClient
          nGebruikers={nGebruikers}
          setNGebruikers={setNGebruikers}
          tierVerdeling={tierVerdeling}
          billingSplit={billingSplit}
          betaalprovider={betaalprovider}
          teamScenario={teamScenario}
        />
      )}

      {tab === 'trackrecord' && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(28px,4vw,48px) clamp(16px,3vw,32px) 64px' }}>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 8 }}>ArnoBot &middot; Interne businesscase</p>
            <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>Trackrecord: prognose vs. werkelijk</h1>
            <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 640 }}>
              Prognose wordt berekend uit écht gemeten gebruik die maand, niet uit de instelbare aannames van de calculator hiernaast. Zo toetst dit of de tarieven zelf kloppen.
            </p>
          </div>
          <TrackrecordClient schrijfWachtwoord={schrijfWachtwoord} setSchrijfWachtwoord={setSchrijfWachtwoord} />
        </div>
      )}

      {tab === 'businesscase' && (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(28px,4vw,48px) clamp(16px,3vw,32px) 64px' }}>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 8 }}>ArnoBot &middot; Interne businesscase</p>
            <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>Business case: omzet, kosten en marge</h1>
          </div>
          <BusinessCaseClient
            nGebruikers={nGebruikers} setNGebruikers={setNGebruikers}
            tierVerdeling={tierVerdeling} setTierVerdeling={setTierVerdeling}
            billingSplit={billingSplit} setBillingSplit={setBillingSplit}
            betaalprovider={betaalprovider} setBetaalprovider={setBetaalprovider}
            teamScenario={teamScenario} setTeamScenario={setTeamScenario}
          />
        </div>
      )}
    </>
  )
}
