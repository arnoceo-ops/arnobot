'use client'

// Vervangt een kale <a href="/sign-up"> zodra we willen weten hoeveel bezoekers op de
// aanmeldknop klikken vóórdat er een account bestaat (funnel-stap "klik", zie
// app/bot/admin/stats/page.tsx). sendBeacon i.p.v. fetch: de link navigeert direct weg,
// een gewone fetch kan door de browser afgebroken worden vóór hij de server bereikt.
export default function SignupCTA({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <a
      href="/sign-up"
      className={className}
      onClick={() => {
        const payload = JSON.stringify({ path: window.location.pathname })
        const blob = new Blob([payload], { type: 'application/json' })
        if (!navigator.sendBeacon('/api/track-cta-click', blob)) {
          fetch('/api/track-cta-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {})
        }
      }}
    >
      {children}
    </a>
  )
}
