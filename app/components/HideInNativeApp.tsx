'use client'

import type { ReactNode } from 'react'
import { useIsNativeApp } from '@/hooks/useIsNativeApp'

// Toont de inhoud niet binnen de Android-app (optioneel een neutrale vervanging). Voor koop-,
// upgrade- en prijsverwijzingen in serverpagina's (Google Play-betalingsbeleid, zie
// docs/MOBILE_PLAN.md).
export default function HideInNativeApp({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const isNativeApp = useIsNativeApp()
  if (isNativeApp) return <>{fallback}</>
  return <>{children}</>
}
