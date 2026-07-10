'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'

export default function NotFoundCapture() {
  const pathname = usePathname()
  useEffect(() => {
    Sentry.captureEvent({
      message: `404: ${pathname}`,
      level: 'warning',
      tags: { type: '404' },
    })
  }, [pathname])
  return null
}
