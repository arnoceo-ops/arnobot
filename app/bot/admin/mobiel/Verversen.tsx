'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Ververst de pagina als je de app weer opent na minstens een minuut weg te zijn geweest.
// Trek-om-te-verversen doet Chrome zelf in een beginscherm-app, dit dekt het terugkeren.
const MIN_TUSSENTIJD_MS = 60_000

export default function Verversen() {
  const router = useRouter()
  const laatste = useRef(0)

  useEffect(() => {
    laatste.current = Date.now()
    function bijTerugkeer() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - laatste.current < MIN_TUSSENTIJD_MS) return
      laatste.current = Date.now()
      router.refresh()
    }
    document.addEventListener('visibilitychange', bijTerugkeer)
    return () => document.removeEventListener('visibilitychange', bijTerugkeer)
  }, [router])

  return (
    <button
      onClick={() => { laatste.current = Date.now(); router.refresh() }}
      aria-label="Verversen"
      style={{ minHeight: 44, minWidth: 44, background: 'transparent', border: 'none', color: '#9ca3af', fontSize: 22, cursor: 'pointer' }}
    >
      ⟳
    </button>
  )
}
