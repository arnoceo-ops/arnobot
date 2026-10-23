'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Balk onderin: de proefperiode loopt bijna af. Zelfde opzet en stijl als VersionBanner. Alleen
// voor wie nog in de proefperiode zit zonder betaling (server bepaalt dat in /api/bot/trial-status),
// vanaf 5 dagen ervoor. Zichtbaar op elke /bot-pagina, behalve op de afrekenpagina zelf.
// Bekijken zonder op dag 25 te zitten: voeg ?trialbalk=5 (1 tot en met 5) aan een /bot-adres toe.
// Dat is puur visueel, het geeft niemand iets en wijzigt niets, en toont de balk ook als je hem
// eerder weggeklikt had.
const SLUIT_KEY = 'arnobot_trialbalk_gesloten'

export default function TrialBalk() {
  const pathname = usePathname()
  const [dagenOver, setDagenOver] = useState<number | null>(null)
  const [gesloten, setGesloten] = useState(false)
  const balkRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const preview = Number(new URLSearchParams(window.location.search).get('trialbalk'))
    if (Number.isInteger(preview) && preview >= 1 && preview <= 5) {
      try { sessionStorage.removeItem(SLUIT_KEY) } catch { /* opslag geblokkeerd */ }
      setGesloten(false)
      setDagenOver(preview)
      return
    }

    try { setGesloten(sessionStorage.getItem(SLUIT_KEY) === '1') } catch { /* opslag geblokkeerd, balk blijft staan */ }

    let cancelled = false
    fetch('/api/bot/trial-status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d && typeof d.dagenOver === 'number') setDagenOver(d.dagenOver) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Pas zichtbaar als het antwoord er is (dagenOver start op null), dus geen flits van een
  // balk voor iemand die hem niet hoort te zien.
  const zichtbaar = dagenOver !== null && !gesloten && pathname !== '/bot/doorgaan'

  // Geef de pagina onderaan evenveel ruimte als de balk hoog is, zodat de laatste regel inhoud
  // niet achter de vaste balk verdwijnt. Weer ongedaan zodra de balk weg is.
  useEffect(() => {
    if (!zichtbaar) return
    const oud = document.body.style.paddingBottom
    document.body.style.paddingBottom = `${balkRef.current?.offsetHeight ?? 0}px`
    return () => { document.body.style.paddingBottom = oud }
  }, [zichtbaar, dagenOver])

  if (!zichtbaar) return null

  const regel1 = dagenOver === 1
    ? 'Je gratis proefperiode loopt vandaag af.'
    : `Je gratis proefperiode loopt over ${dagenOver} dagen af.`

  return (
    <>
      <style>{`
        .trialbalk-tekst { padding: 0 8px; }
        @media (max-width: 700px) { .trialbalk-tekst { padding: 0 64px 0 8px; } }
      `}</style>
      <div ref={balkRef} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 149, background: '#1f2937', padding: '0 clamp(20px,4vw,32px) clamp(14px,2vw,18px)' }}>
        {/* Amber lijn kolombreed (650px, de kolom van de hoofdpagina), niet schermbreed. */}
        <div style={{ maxWidth: 650, margin: '0 auto', borderTop: '2px solid #f59e0b', marginBottom: 'clamp(14px,2vw,18px)' }} />
        <button
          onClick={() => { setGesloten(true); try { sessionStorage.setItem(SLUIT_KEY, '1') } catch { /* niet erg */ } }}
          aria-label="Sluiten"
          style={{ position: 'absolute', top: 'clamp(8px,1.5vw,12px)', right: 'clamp(12px,2vw,24px)', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px' }}
        >
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, color: '#9ca3af', lineHeight: 1 }}>×</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: 1, color: '#6b7280' }}>sluiten</span>
        </button>
        <div className="trialbalk-tekst" style={{ maxWidth: 812, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af' }}>{regel1}</span>
          <a
            href="/bot/doorgaan"
            style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', textDecoration: 'none' }}
          ><span style={{ color: '#f59e0b' }}>Kies je abonnement</span> om door te gaan →</a>
        </div>
      </div>
    </>
  )
}
