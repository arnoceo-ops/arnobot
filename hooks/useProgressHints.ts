'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'

interface HintStatus {
  convsSinceLastAnalysis: number
  daysSinceLastAnalysis: number | null
  analysesSinceLastCoaching: number
  daysSinceLastCoaching: number | null
  convsSinceLastCoaching: number
}

const THROTTLE_ANALYSES_DAYS = 7
const THROTTLE_COACHING_DAYS = 14

export function useProgressHints() {
  const { user } = useUser()
  const userId = user?.id
  const [status, setStatus] = useState<HintStatus | null>(null)
  const [dismissed, setDismissed] = useState<Record<string, number>>({})

  const fetchStatus = useCallback(() => {
    fetch('/api/bot/hint-status')
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!userId) return
    const keys = ['analyses', 'coaching']
    const loaded: Record<string, number> = {}
    for (const k of keys) {
      const raw = localStorage.getItem(`arnobot_hint_${k}_${userId}`)
      if (raw) loaded[k] = parseInt(raw, 10)
    }
    setDismissed(loaded)
    fetchStatus()
  }, [userId, fetchStatus])

  function isDismissedRecently(type: string, days: number): boolean {
    const ts = dismissed[type]
    if (!ts) return false
    return Date.now() - ts < days * 86400000
  }

  function dismiss(type: string) {
    if (!userId) return
    const ts = Date.now()
    localStorage.setItem(`arnobot_hint_${type}_${userId}`, String(ts))
    setDismissed(prev => ({ ...prev, [type]: ts }))
  }

  const s = status

  const showAnalysesHint =
    !!s && s.convsSinceLastAnalysis >= 3 && !isDismissedRecently('analyses', THROTTLE_ANALYSES_DAYS)

  const showCoachingHintA =
    !!s && s.analysesSinceLastCoaching >= 1 && !isDismissedRecently('coaching', THROTTLE_COACHING_DAYS)

  const showCoachingHintB =
    !!s &&
    s.daysSinceLastCoaching !== null &&
    s.daysSinceLastCoaching >= 30 &&
    s.convsSinceLastCoaching >= 3 &&
    !isDismissedRecently('coaching', THROTTLE_COACHING_DAYS)

  const showCoachingHint = showCoachingHintA || showCoachingHintB
  const activeCoachingHint: 'A' | 'B' | null = showCoachingHintA ? 'A' : showCoachingHintB ? 'B' : null

  return {
    showAnalysesHint,
    showCoachingHint,
    activeCoachingHint,
    convsSinceLastAnalysis: s?.convsSinceLastAnalysis ?? 0,
    analysesSinceLastCoaching: s?.analysesSinceLastCoaching ?? 0,
    daysSinceLastCoaching: s?.daysSinceLastCoaching ?? null,
    convsSinceLastCoaching: s?.convsSinceLastCoaching ?? 0,
    userId,
    refreshHints: fetchStatus,
    dismissAnalysesHint: () => dismiss('analyses'),
    dismissCoachingHint: () => dismiss('coaching'),
  }
}
