'use client'

import { useState } from 'react'
import KostenCalculatorClient from './KostenCalculatorClient'
import TrackrecordClient from './TrackrecordClient'

export default function KostenPageClient() {
  const [tab, setTab] = useState<'calculator' | 'trackrecord'>('calculator')

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #111827; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 14px; }
      `}</style>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(28px,4vw,48px) clamp(16px,3vw,32px) 0' }}>
        <div style={{ display: 'inline-flex', background: '#1a2333', border: '1px solid #2d3a4f', borderRadius: 999, padding: 3, marginBottom: 8 }}>
          <button
            onClick={() => setTab('calculator')}
            style={{
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '8px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: tab === 'calculator' ? '#f59e0b' : 'transparent',
              color: tab === 'calculator' ? '#111827' : '#94a3b8',
            }}
          >
            Calculator
          </button>
          <button
            onClick={() => setTab('trackrecord')}
            style={{
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '8px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: tab === 'trackrecord' ? '#f59e0b' : 'transparent',
              color: tab === 'trackrecord' ? '#111827' : '#94a3b8',
            }}
          >
            Trackrecord
          </button>
        </div>
      </div>
      {tab === 'calculator' ? <KostenCalculatorClient /> : (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 clamp(16px,3vw,32px) 64px' }}>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 8 }}>ArnoBot &middot; Interne businesscase</p>
            <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>Trackrecord: prognose vs. werkelijk</h1>
            <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 640 }}>
              Prognose wordt berekend uit écht gemeten gebruik die maand, niet uit de instelbare aannames van de calculator hiernaast. Zo toetst dit of de tarieven zelf kloppen.
            </p>
          </div>
          <TrackrecordClient />
        </div>
      )}
    </>
  )
}
