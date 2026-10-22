'use client'

import { useEffect, useState } from 'react'
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

// Doel na het inloggen, door /sign-in in sessionStorage gezet. Alleen een pad onder /bot (geen
// open redirect), anders de standaard /bot.
function leesDoel(): string {
  try {
    const raw = sessionStorage.getItem('arnobot_na_inloggen')
    sessionStorage.removeItem('arnobot_na_inloggen')
    if (raw && raw.startsWith('/') && !raw.startsWith('//') && (raw === '/bot' || raw.startsWith('/bot/') || raw.startsWith('/bot?'))) return raw
  } catch {}
  return '/bot'
}

export default function SSOCallback() {
  // Het doel moet bekend zijn voordat AuthenticateWithRedirectCallback rendert, anders gebruikt
  // die al de standaard-redirect.
  const [doel, setDoel] = useState<string | null>(null)
  useEffect(() => { setDoel(leesDoel()) }, [])

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; }
        .loading-dot { width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', gap: 20 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div className="loading-dot" />
          <div className="loading-dot" />
          <div className="loading-dot" />
        </div>
        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#9ca3af' }}>
          ARNO DENKT NA
        </p>
        {doel && (
          <AuthenticateWithRedirectCallback
            signInForceRedirectUrl={doel}
            signUpForceRedirectUrl={doel}
          />
        )}
      </div>
    </>
  )
}
