'use client'

import { useVersionCheck } from '@/hooks/useVersionCheck'

export default function VersionBanner() {
  const { updateAvailable, dismiss } = useVersionCheck()
  if (!updateAvailable) return null

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 150, background: '#1f2937', borderTop: '1px solid #374151', padding: 'clamp(12px,2vw,16px) clamp(20px,4vw,32px)' }}>
      <div style={{ maxWidth: 812, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af' }}>
          Er is een nieuwe versie van ArnoBot beschikbaar.
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => window.location.reload()}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >VERNIEUWEN</button>
          <button
            onClick={dismiss}
            style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
            aria-label="Sluiten"
          >×</button>
        </div>
      </div>
    </div>
  )
}
