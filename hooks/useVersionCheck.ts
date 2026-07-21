'use client'

import { useEffect, useRef, useState } from 'react'

const RECHECK_THROTTLE_MS = 60000

export function useVersionCheck() {
  const baselineRef = useRef<string | null>(null)
  const lastCheckRef = useRef(0)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch('/api/version')
      .then(r => r.json())
      .then(d => { if (!cancelled) baselineRef.current = d.buildId })
      .catch(() => {})

    function check() {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastCheckRef.current < RECHECK_THROTTLE_MS) return
      lastCheckRef.current = now
      fetch('/api/version')
        .then(r => r.json())
        .then(d => {
          if (baselineRef.current && d.buildId && d.buildId !== baselineRef.current) {
            setUpdateAvailable(true)
          }
        })
        .catch(() => {})
    }

    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  return { updateAvailable, dismiss: () => setUpdateAvailable(false) }
}
