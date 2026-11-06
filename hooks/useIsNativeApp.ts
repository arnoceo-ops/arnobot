'use client'

import { useSyncExternalStore } from 'react'

// True binnen de Android-app (Capacitor-WebView), anders false. Gebruikt om koop-, upgrade- en
// prijsverwijzingen in de app te verbergen (Google Play-betalingsbeleid, zie docs/MOBILE_PLAN.md).
// useSyncExternalStore met server-snapshot false: geen hydration-verschil, en na hydratatie
// direct de juiste waarde.
function subscribe() {
  return () => {}
}

function getSnapshot(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!cap?.isNativePlatform?.()
}

export function useIsNativeApp(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
