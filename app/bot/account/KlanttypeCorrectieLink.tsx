'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// De link naar de pagina waar een per ongeluk als particulier afgesloten abonnement zakelijk wordt gecorrigeerd
// (/bot/account/zakelijk-corrigeren). Alleen zichtbaar voor wie zo'n abonnement heeft: dezelfde controle als de pagina zelf
// (GET /api/bot/klanttype-correctie geeft `abonnement: null` als er niets te corrigeren valt). Voor iedereen anders is de
// link nutteloos en blijft hij weg. Eerst nergens tonen, pas bij een bevestigd antwoord.
export default function KlanttypeCorrectieLink() {
  const [teCorrigeren, setTeCorrigeren] = useState(false)

  useEffect(() => {
    let geannuleerd = false
    fetch('/api/bot/klanttype-correctie', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!geannuleerd && d?.abonnement) setTeCorrigeren(true) })
      .catch(() => {})
    return () => { geannuleerd = true }
  }, [])

  if (!teCorrigeren) return null
  return (
    <p style={{ marginTop: 24 }}>
      <Link href="/bot/account/zakelijk-corrigeren" style={{ color: '#6b7280', fontSize: 13, letterSpacing: 1, textDecoration: 'underline' }}>
        Per ongeluk particulier besteld in plaats van zakelijk?
      </Link>
    </p>
  )
}
