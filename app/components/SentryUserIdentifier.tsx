'use client'

import * as Sentry from '@sentry/nextjs'
import { useUser } from '@clerk/nextjs'
import { useEffect } from 'react'

export default function SentryUserIdentifier() {
  const { user } = useUser()

  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        username: user.fullName ?? undefined,
      })
    } else {
      Sentry.setUser(null)
    }
  }, [user])

  return null
}
