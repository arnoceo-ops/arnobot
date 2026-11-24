'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { BRON_COOKIE, BRON_COOKIE_DAGEN, schoonBron } from '@/lib/bron'

// Alleen de publieke marketingpagina's tellen mee als "bezoeker" voor de
// funnel. /bot (het product zelf), /abacus (interne tool) en de auth-/api-
// routes zijn geen onderdeel van "bezoeker -> trial".
const UITGESLOTEN_PREFIXES = ['/bot', '/abacus', '/api', '/sign-in', '/sign-up', '/sso-callback', '/clerk-proxy', '/monitoring', '/blog/bevestig', '/blog/afmelden']

export default function PageviewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (UITGESLOTEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return

    // Bronattributie (folder-QR, docs/FOLDER_PLAN.md): ?bron=<code> wordt 30 dagen als cookie
    // bewaard, zodat de klik op de aanmeldknop en de aanmelding zelf later aan dezelfde bron
    // te koppelen zijn. Zelfde patroon als arnobot_ref en arnobot_sd in app/aanmelden.
    const bron = schoonBron(new URLSearchParams(window.location.search).get('bron'))
    if (bron) {
      document.cookie = `${BRON_COOKIE}=${bron}; path=/; max-age=${BRON_COOKIE_DAGEN * 24 * 60 * 60}; SameSite=Lax`
    }

    const payload = JSON.stringify({ path: pathname, referrer: document.referrer || null, bron })
    const blob = new Blob([payload], { type: 'application/json' })
    if (!navigator.sendBeacon('/api/track-pageview', blob)) {
      fetch('/api/track-pageview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {})
    }
  }, [pathname])

  return null
}
