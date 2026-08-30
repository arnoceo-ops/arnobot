'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import posthog from 'posthog-js'
import { SESSION_REPLAY_ENABLED, isReplayAllowedPath } from '@/lib/posthog'

// Zet session replay per route aan of uit. Nooit automatisch: alleen als
// SESSION_REPLAY_ENABLED (lib/posthog.ts) aan staat EN de route op de allowlist
// staat EN de gebruiker is ingelogd. Op elke andere route wordt een lopende opname
// direct gestopt, zodat navigeren van /bot/account naar /bot/coaching de opname
// beeindigt voordat er coachinginhoud in beeld komt.
//
// Maskering (alle tekst, alle invoer) staat in de posthog.init-config in
// PostHogTracker.tsx, niet hier.
export default function PostHogSessionReplay() {
  const pathname = usePathname()
  const { isSignedIn } = useAuth()

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    if (!pathname) return

    const shouldRecord = SESSION_REPLAY_ENABLED && isSignedIn === true && isReplayAllowedPath(pathname)

    try {
      if (shouldRecord) {
        posthog.startSessionRecording()
      } else {
        posthog.stopSessionRecording()
      }
    } catch {
      // bewust stil: replay-besturing mag de app nooit raken
    }
  }, [pathname, isSignedIn])

  return null
}
