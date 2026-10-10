'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  token: string
  endpoint: string
  kop: string
  tekst: string
  knop: string
  gelukt: string
  ongeldig: string
  fout: string
  children?: React.ReactNode
}

// Eén knop die een POST doet met het token uit de link. Gebruikt voor bevestigen en afmelden:
// de actie gebeurt bewust pas na een klik, niet bij het openen van de pagina, omdat mailscanners
// links automatisch openen.
export default function TokenAction({ token, endpoint, kop, tekst, knop, gelukt, ongeldig, fout, children }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'invalid' | 'error'>('idle')

  async function run() {
    if (state === 'loading') return
    setState('loading')
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      setState(res.ok ? 'done' : res.status === 400 ? 'invalid' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <main className="bl-narrow">
      <h1 className="bl-title">{kop}</h1>
      {state === 'done' ? (
        <>
          <p role="status" className="bl-sub">{gelukt}</p>
          <p style={{ marginTop: 32 }}><Link href="/blog" className="bl-btn-secondary">Naar de blog</Link></p>
        </>
      ) : state === 'invalid' ? (
        <p role="alert" className="bl-sub">{ongeldig}</p>
      ) : (
        <>
          <p className="bl-sub">{tekst}</p>
          <p style={{ marginTop: 32 }}>
            <button type="button" className="bl-btn" onClick={run} disabled={state === 'loading'}>{knop}</button>
          </p>
          {state === 'error' && <p role="alert" className="bl-msg err" style={{ marginTop: 16 }}>{fout}</p>}
          {children}
        </>
      )}
    </main>
  )
}
