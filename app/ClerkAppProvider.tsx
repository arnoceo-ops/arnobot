'use client'

import { ClerkProvider } from '@clerk/nextjs'

// Forceert een echte browser-navigatie i.p.v. Next.js client-side routing voor elke
// Clerk-geïnitieerde redirect (met name de LinkedIn SSO-callback na /sso-callback).
// Next.js' Router Cache kende het gebruikersstatus-onafhankelijke, gecachete /bot-shell
// van vóór het inloggen nog, waardoor de pagina na inloggen soms met de verkeerde
// achtergrondkleur laadde totdat een harde refresh de cache omzeilde. Een window-redirect
// haalt altijd een verse, server-gerenderde pagina op en sluit dit probleem volledig uit.
function hardNavigate(to: string) {
  window.location.href = to
}

export default function ClerkAppProvider({ nonce, children }: { nonce?: string; children: React.ReactNode }) {
  return (
    <ClerkProvider
      nonce={nonce}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInForceRedirectUrl="/bot"
      signUpForceRedirectUrl="/bot"
      routerPush={hardNavigate}
      routerReplace={hardNavigate}
    >
      {children}
    </ClerkProvider>
  )
}
