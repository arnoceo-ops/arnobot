'use client'

// Zolang een coaching of analyse wordt geschreven (minuten): wie een link aanklikt of het tabblad
// sluit, krijgt eerst een melding. Next.js App Router heeft geen navigatie-events, daarom een
// klik-luisteraar in de capture-fase op linkklikken, plus beforeunload voor sluiten en herladen
// (de tekst daarvan is die van de browser, niet aanpasbaar). Wegklikken blijft altijd mogelijk.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WeggaanWaarschuwing({ actief, soort }: { actief: boolean; soort: 'analyse' | 'coaching' }) {
  const router = useRouter()
  const [doel, setDoel] = useState<string | null>(null)
  const doorgelaten = useRef(false)

  useEffect(() => {
    if (!actief) return

    function onClick(e: MouseEvent) {
      if (doorgelaten.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return
      const zelfdePagina = url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search
      if (zelfdePagina && url.hash) return // alleen naar een anker op de pagina zelf
      e.preventDefault()
      e.stopPropagation()
      setDoel(url.origin === window.location.origin ? url.pathname + url.search + url.hash : url.href)
    }
    function onUnload(e: BeforeUnloadEvent) {
      if (doorgelaten.current) return
      e.preventDefault()
      e.returnValue = ''
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [actief])

  useEffect(() => {
    if (!doel) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDoel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doel])

  if (!actief || !doel) return null

  function toch() {
    if (!doel) return
    doorgelaten.current = true
    const bestemming = doel
    setDoel(null)
    if (bestemming.startsWith('/')) router.push(bestemming)
    else window.location.href = bestemming
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Nieuwe analyse wordt geschreven"
      onClick={() => setDoel(null)}
      className="no-print"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(17,24,39,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#1f2937', border: '1px solid #374151', maxWidth: 460, width: '100%', padding: 32, textAlign: 'center' }}
      >
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, lineHeight: 1.9, color: '#f1f5f9', marginBottom: 28 }}>
          Er wordt nog een nieuwe {soort} geschreven. Weet je zeker dat je weggaat?
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            autoFocus
            onClick={() => setDoel(null)}
            style={{ background: '#f59e0b', border: 'none', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#111827', padding: '12px 32px', borderRadius: 999 }}
          >
            BLIJF
          </button>
          <button
            onClick={toch}
            style={{ background: 'none', border: '1px solid #374151', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#9ca3af', padding: '11px 28px', borderRadius: 999 }}
          >
            TOCH WEG
          </button>
        </div>
      </div>
    </div>
  )
}
