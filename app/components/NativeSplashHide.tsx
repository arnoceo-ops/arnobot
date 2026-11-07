'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

// Verbergt de native splash (logo op donkerblauw) in de Android-app zodra de pagina is geladen.
// In de browser doet dit niets. Oudere app-versies zonder splash-plug-in negeren de fout stil.
export default function NativeSplashHide() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    import('@capacitor/splash-screen')
      .then(m => m.SplashScreen.hide({ fadeOutDuration: 250 }))
      .catch(() => {})
  }, [])
  return null
}
