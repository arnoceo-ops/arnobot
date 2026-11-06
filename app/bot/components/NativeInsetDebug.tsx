'use client'

import { useEffect, useState } from 'react'

// TIJDELIJK (2026-11-06): meetregel om te zien welke statusbalkwaarden de Android-WebView
// doorgeeft. Alleen zichtbaar binnen de Capacitor-app. Verwijderen zodra de statusbalkfix staat.
export default function NativeInsetDebug() {
  const [tekst, setTekst] = useState('')

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (!cap?.isNativePlatform?.()) return
    const meet = () => {
      const probe = document.createElement('div')
      probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px)'
      document.body.appendChild(probe)
      const envTop = getComputedStyle(probe).paddingTop
      document.body.removeChild(probe)
      const root = getComputedStyle(document.documentElement)
      const injected = root.getPropertyValue('--safe-area-inset-top').trim() || 'leeg'
      const sai = root.getPropertyValue('--sai').trim() || 'leeg'
      const nav = document.querySelector('.mob-nav')?.getBoundingClientRect()
      const vv = window.visualViewport
      setTekst(
        `env=${envTop} inj=${injected} sai=${sai} navTop=${nav ? Math.round(nav.top) : '-'} navH=${nav ? Math.round(nav.height) : '-'} ` +
        `inner=${window.innerWidth}x${window.innerHeight} vv=${vv ? Math.round(vv.offsetTop) : '-'} scrollY=${Math.round(window.scrollY)} dpr=${window.devicePixelRatio}`
      )
    }
    meet()
    const t = setInterval(meet, 1500)
    return () => clearInterval(t)
  }, [])

  if (!tekst) return null
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999, background: '#000', color: '#0f0', fontFamily: 'monospace', fontSize: 11, padding: '6px 8px', wordBreak: 'break-all' }}>
      {tekst}
    </div>
  )
}
