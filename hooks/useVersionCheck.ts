'use client'

import { useEffect, useRef, useState } from 'react'

const RECHECK_THROTTLE_MS = 60000
// Ingebakken in de bundel bij het bouwen (zie next.config.ts). Op een verouderde, al
// geladen pagina is dit dus de OUDE waarde, ook al draait de server zelf de nieuwe build.
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || null

export function useVersionCheck() {
  const lastCheckRef = useRef(0)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!BUILD_ID || BUILD_ID === 'dev') return

    function check() {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastCheckRef.current < RECHECK_THROTTLE_MS) return
      lastCheckRef.current = now
      fetch('/api/version', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          if (d.buildId && d.buildId !== BUILD_ID) {
            setUpdateAvailable(true)
          }
        })
        .catch(() => {})
    }

    // Meteen checken bij het laden, niet pas wachten op een volgend focus/visibility-event.
    // Dat ving alleen updates op die gebeurden terwijl het tabblad al open stond, niet een
    // pagina die al verouderd was op het moment van laden.
    check()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  return { updateAvailable, dismiss: () => setUpdateAvailable(false) }
}
