'use client'

import { useEffect } from 'react'

// In de Android-app (Capacitor) heeft de homepage geen functie: wie de app opent wil inloggen of
// naar zijn gesprekken. Een niet-ingelogde bezoeker komt via /bot vanzelf op het inlogscherm
// (proxy.ts), een ingelogde bezoeker landt er direct (zie de redirect in app/page.tsx).
export default function NativeAppRedirect() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (cap?.isNativePlatform?.()) window.location.replace('/bot')
  }, [])
  return null
}
