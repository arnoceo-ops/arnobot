'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import posthog from 'posthog-js'

// Zones:
// - VOLLEDIG UITGESLOTEN: geen enkele tracking. Interne tools, auth-flow, admin.
// - /bot (product): pseudonieme productanalyse van ingelogde gebruikers. identify() met
//   Clerk user_id, genormaliseerde $pageview (geen echte IDs/query in het pad).
// - Publiek (marketing): anonieme $pageview, ongewijzigd gedrag.
//
// Session replay staat globaal uit (disable_session_recording) en wordt apart en bewust
// aangezet, zie app/components/PostHogSessionReplay.tsx. Autocapture staat uit: die zou
// op /bot knoplabels en DOM-tekst met coaching-inhoud meepakken.
const VOLLEDIG_UITGESLOTEN = [
  '/abacus', '/api', '/sign-in', '/sign-up', '/sso-callback', '/clerk-proxy', '/monitoring',
  '/bot/admin',
]

function isExcluded(pathname: string): boolean {
  return VOLLEDIG_UITGESLOTEN.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function isBot(pathname: string): boolean {
  return pathname === '/bot' || pathname.startsWith('/bot/')
}

// Vervang segmenten die een ID zijn door :id, zodat /bot/team/lid/user_xxx niet als
// aparte pagina in PostHog verschijnt (en het user_id niet in analytics belandt).
function normalizePath(pathname: string): string {
  return pathname
    .split('/')
    .map(seg => {
      if (/^user_[A-Za-z0-9]+$/.test(seg)) return ':id'
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ':id'
      if (/^\d{4,}$/.test(seg)) return ':id'
      return seg
    })
    .join('/')
}

export default function PostHogTracker() {
  const pathname = usePathname()
  const { isSignedIn, userId } = useAuth()
  const initialized = useRef(false)
  const identifiedFor = useRef<string | null>(null)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return
    if (!initialized.current) {
      posthog.init(key, {
        api_host: '/site-relay',
        ui_host: 'https://eu.posthog.com',
        person_profiles: 'always',
        // Session replay start NOOIT automatisch: PostHogSessionReplay.tsx roept per
        // toegestane route expliciet startSessionRecording() aan, en alleen als de vlag
        // SESSION_REPLAY_ENABLED aan staat. De config hieronder bepaalt hoe een opname
        // eruitziet als hij wel loopt: alle tekst en alle invoer gemaskeerd (je ziet
        // layout en klikgedrag, geen woorden), geen netwerk-payloads.
        disable_session_recording: true,
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: '*',
          maskInputOptions: { password: true, email: true, text: true, search: true, tel: true, url: true },
          recordHeaders: false,
          recordBody: false,
          recordCrossOriginIframes: false,
        },
        capture_pageview: false,
        // Zou op /bot knoplabels en zichtbare coaching-tekst meepakken. Uit.
        autocapture: false,
      })
      initialized.current = true
    }

    if (!pathname) return
    if (isExcluded(pathname)) return

    const onBot = isBot(pathname)

    // identify: koppel de PostHog-persoon aan het Clerk user_id en zet de veilige
    // account-properties. Eén keer per gebruiker per mount.
    if (onBot && isSignedIn && userId && identifiedFor.current !== userId) {
      identifiedFor.current = userId
      fetch('/api/bot/posthog-identity')
        .then(r => (r.ok ? r.json() : null))
        .then((data: { distinctId: string; props: Record<string, unknown> } | null) => {
          if (!data) return
          posthog.identify(data.distinctId, data.props)
          const teamId = data.props.team_id
          if (typeof teamId === 'string' && teamId) {
            // Als super-property staat team_id op elk volgend event: uitsplitsen per
            // klant-team zonder de betaalde group-analytics-add-on.
            posthog.register({ team_id: teamId })
          }
        })
        .catch(() => {})
    }

    // Reset bij uitloggen zodat een volgende gebruiker op hetzelfde tabblad opnieuw
    // geidentificeerd wordt en geen events erft.
    if (!isSignedIn && identifiedFor.current !== null) {
      identifiedFor.current = null
      try { posthog.reset() } catch {}
    }

    if (onBot) {
      // Overschrijf $current_url expliciet: geen query string (bijv. ?token=), geen
      // echte IDs in het pad. Zo belandt er geen herleidbare URL in PostHog.
      const cleanPath = normalizePath(pathname)
      posthog.capture('$pageview', {
        $current_url: window.location.origin + cleanPath,
        $pathname: cleanPath,
      })
    } else {
      posthog.capture('$pageview')
    }
  }, [pathname, isSignedIn, userId])

  return null
}
