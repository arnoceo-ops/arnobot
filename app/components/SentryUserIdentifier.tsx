'use client'

import * as Sentry from '@sentry/nextjs'
import { useUser } from '@clerk/nextjs'
import { useEffect } from 'react'

export default function SentryUserIdentifier() {
  const { user } = useUser()

  useEffect(() => {
    if (user) {
      // Alleen het account-id: geen naam of e-mailadres naar Sentry.
      Sentry.setUser({ id: user.id })
    } else {
      Sentry.setUser(null)
    }
  }, [user])

  return null
}
