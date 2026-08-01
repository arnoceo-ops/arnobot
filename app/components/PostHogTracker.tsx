'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'

// Alleen de publieke marketingpagina's, zelfde grens als PageviewTracker.tsx: /bot (het
// product zelf, ingelogde klanten) hoort hier niet bij, dat is een principieel andere
// privacy-afweging (sessie-opnames van betalende klanten i.p.v. anonieme bezoekers) die
// niet stilzwijgend is meegenomen met deze toevoeging.
const UITGESLOTEN_PREFIXES = ['/bot', '/abacus', '/api', '/sign-in', '/sign-up', '/sso-callback', '/clerk-proxy', '/monitoring', '/command']

export default function PostHogTracker() {
  const pathname = usePathname()
  const initialized = useRef(false)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return
    if (!initialized.current) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
        // 'always' i.p.v. 'identified_only': de ingebouwde dashboard-tegels (Active/Daily/
        // Weekly users, Retention) tellen unieke personen, niet losse events. Zonder een
        // Person-profiel per anonieme bezoeker blijven die tegels op 0 staan, ook al komen
        // de losse Pageview-events wel binnen. Verandert niet wélke data verzameld wordt,
        // alleen hoe PostHog 'm intern organiseert.
        person_profiles: 'always',
        // Bewust uit: dit is een anonieme marketingpagina-tracker, geen productanalyse van
        // ingelogde klanten. Alleen expliciet aanzetten na een eigen, los besluit daarover.
        disable_session_recording: true,
        capture_pageview: false, // handmatig hieronder, zie comment bij usePathname
        // Autocapture luistert globaal naar alle klikken in de hele SPA, ook nadat een
        // bezoeker via client-side navigatie in /bot terechtkomt (geen page-reload, dus
        // deze listener blijft actief). UITGESLOTEN_PREFIXES filtert alleen onze eigen
        // $pageview-call, niet autocapture zelf. Daarom uit, en in plaats daarvan alleen
        // expliciete capture()-calls op componenten die alleen op publieke pagina's staan
        // (zie SignupCTA.tsx).
        autocapture: false,
      })
      initialized.current = true
    }

    if (!pathname) return
    if (UITGESLOTEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return
    posthog.capture('$pageview')
  }, [pathname])

  return null
}
