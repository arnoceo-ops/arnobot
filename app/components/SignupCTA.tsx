'use client'

import posthog from 'posthog-js'

// Vervangt een kale <a href="/sign-up"> zodra we willen weten hoeveel bezoekers op de
// aanmeldknop klikken vóórdat er een account bestaat (funnel-stap "klik", zie
// app/bot/admin/stats/page.tsx). sendBeacon i.p.v. fetch: de link navigeert direct weg,
// een gewone fetch kan door de browser afgebroken worden vóór hij de server bereikt.
//
// Stuurt zowel naar onze eigen arnobot_cta_clicks (voedt de funnel-tegel op admin/stats,
// blijft werken ongeacht PostHog) als naar PostHog (voor funnel/sessie-analyse daar).
// Autocapture staat in PostHogTracker.tsx bewust uit (zie comment daar), dus dit is een
// expliciete capture-call, veilig hier omdat dit component alleen op publieke
// marketingpagina's wordt gebruikt, nooit binnen /bot.
export default function SignupCTA({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <a
      href="/sign-up"
      className={className}
      onClick={() => {
        const path = window.location.pathname
        const payload = JSON.stringify({ path })
        const blob = new Blob([payload], { type: 'application/json' })
        if (!navigator.sendBeacon('/api/track-cta-click', blob)) {
          fetch('/api/track-cta-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {})
        }
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.capture('cta_click_signup', { path })
        }
      }}
    >
      {children}
    </a>
  )
}
