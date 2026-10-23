'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// Balk onderin: de proefperiode loopt bijna af. Zelfde opzet en stijl als VersionBanner. Alleen
// voor wie nog in de proefperiode zit zonder betaling (server bepaalt dat in /api/bot/trial-status),
// vanaf 5 dagen ervoor. Zichtbaar op elke /bot-pagina, behalve op de afrekenpagina zelf.
// Bekijken zonder op dag 25 te zitten: voeg ?trialbalk=5 (1 tot en met 5) aan een /bot-adres toe.
// Dat is puur visueel, het geeft niemand iets en wijzigt niets.
const SLUIT_KEY = 'arnobot_trialbalk_gesloten'

export default function TrialBalk() {
  const pathname = usePathname()
  const [dagenOver, setDagenOver] = useState<number | null>(null)
  const [gesloten, setGesloten] = useState(false)

  useEffect(() => {
    try { setGesloten(sessionStorage.getItem(SLUIT_KEY) === '1') } catch { /* opslag geblokkeerd, balk blijft staan */ }

    const preview = Number(new URLSearchParams(window.location.search).get('trialbalk'))
    if (Number.isInteger(preview) && preview >= 1 && preview <= 5) {
      setDagenOver(preview)
      return
    }

    let cancelled = false
    fetch('/api/bot/trial-status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d && typeof d.dagenOver === 'number') setDagenOver(d.dagenOver) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Pas zichtbaar als het antwoord er is (dagenOver start op null), dus geen flits van een
  // balk voor iemand die hem niet hoort te zien.
  if (dagenOver === null || gesloten || pathname === '/bot/doorgaan') return null

  const tekst = dagenOver === 1
    ? 'Je gratis proefperiode loopt vandaag af. Kies je abonnement om door te gaan.'
    : `Je gratis proefperiode loopt over ${dagenOver} dagen af. Kies je abonnement om door te gaan.`

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 149, background: '#1f2937', borderTop: '2px solid #f59e0b', padding: 'clamp(12px,2vw,16px) clamp(20px,4vw,32px)' }}>
      <div style={{ maxWidth: 812, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af' }}>{tekst}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a
            href="/bot/doorgaan"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#f59e0b', textDecoration: 'none' }}
          >GA DOOR →</a>
          <button
            onClick={() => { setGesloten(true); try { sessionStorage.setItem(SLUIT_KEY, '1') } catch { /* niet erg */ } }}
            style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
            aria-label="Sluiten"
          >×</button>
        </div>
      </div>
    </div>
  )
}
