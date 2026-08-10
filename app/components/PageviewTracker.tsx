'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Alleen de publieke marketingpagina's tellen mee als "bezoeker" voor de
// funnel. /bot (het product zelf), /abacus (interne tool) en de auth-/api-
// routes zijn geen onderdeel van "bezoeker -> trial".
const UITGESLOTEN_PREFIXES = ['/bot', '/abacus', '/api', '/sign-in', '/sign-up', '/sso-callback', '/clerk-proxy', '/monitoring']

export default function PageviewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (UITGESLOTEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return

    const payload = JSON.stringify({ path: pathname, referrer: document.referrer || null })
    const blob = new Blob([payload], { type: 'application/json' })
    if (!navigator.sendBeacon('/api/track-pageview', blob)) {
      fetch('/api/track-pageview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {})
    }
  }, [pathname])

  return null
}
