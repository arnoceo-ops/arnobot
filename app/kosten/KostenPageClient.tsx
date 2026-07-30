'use client'

import { useState } from 'react'
import KostenCalculatorClient from './KostenCalculatorClient'
import TrackrecordClient from './TrackrecordClient'
import BusinessCaseClient from './BusinessCaseClient'

type Tab = 'calculator' | 'trackrecord' | 'businesscase'

const TABS: { id: Tab; label: string }[] = [
  { id: 'calculator', label: 'Calculator' },
  { id: 'trackrecord', label: 'Trackrecord' },
  { id: 'businesscase', label: 'Business case' },
]

export default function KostenPageClient() {
  const [tab, setTab] = useState<Tab>('calculator')
  // Gedeeld tussen Trackrecord (gebruikt dit bij "sluit maand af") en Business
  // case (waar je ze instelt), zodat wat je op tab 3 ziet ook echt wordt
  // vastgelegd als je op tab 2 een maand afsluit.
  const [prijzen, setPrijzen] = useState({ basis: 37, premium: 77, elite: 397 })

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

      {tab === 'calculator' && <KostenCalculatorClient />}

      {tab === 'trackrecord' && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 clamp(16px,3vw,32px) 64px' }}>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 8 }}>ArnoBot &middot; Interne businesscase</p>
            <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>Trackrecord: prognose vs. werkelijk</h1>
            <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 640 }}>
              Prognose wordt berekend uit écht gemeten gebruik die maand, niet uit de instelbare aannames van de calculator hiernaast. Zo toetst dit of de tarieven zelf kloppen.
            </p>
          </div>
          <TrackrecordClient prijzen={prijzen} />
        </div>
      )}

      {tab === 'businesscase' && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 clamp(16px,3vw,32px) 64px' }}>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 8 }}>ArnoBot &middot; Interne businesscase</p>
            <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>Business case: omzet, kosten en marge</h1>
            <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 640 }}>
              Omzet is het aantal betalende gebruikers per plan (echt gemeten uit `approved_users`) keer het tarief per plan. Command telt niet mee, dat heeft geen vlak tarief.
            </p>
          </div>
          <BusinessCaseClient prijzen={prijzen} setPrijzen={setPrijzen} />
        </div>
      )}
    </>
  )
}
