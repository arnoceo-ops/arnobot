'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'

interface HintStatus {
  convCount: number
  analysisCount: number
  coachingCount: number
}

export function useProgressHints() {
  const { user } = useUser()
  const userId = user?.id
  const [status, setStatus] = useState<HintStatus | null>(null)
  const [seenAnalyses, setSeenAnalyses] = useState(true)
  const [seenCoaching, setSeenCoaching] = useState(true)

  useEffect(() => {
    if (!userId) return
    setSeenAnalyses(localStorage.getItem(`arnobot_seen_analyses_hint_${userId}`) === 'true')
    setSeenCoaching(localStorage.getItem(`arnobot_seen_coaching_hint_${userId}`) === 'true')
    fetch('/api/bot/hint-status')
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => {})
  }, [userId])

  function dismissAnalysesHint() {
    if (!userId) return
    localStorage.setItem(`arnobot_seen_analyses_hint_${userId}`, 'true')
    setSeenAnalyses(true)
  }

  function dismissCoachingHint() {
    if (!userId) return
    localStorage.setItem(`arnobot_seen_coaching_hint_${userId}`, 'true')
    setSeenCoaching(true)
  }

  const showAnalysesHint = !!status && status.convCount >= 3 && status.analysisCount === 0 && !seenAnalyses
  const showCoachingHint = !!status && status.analysisCount > 0 && status.coachingCount === 0 && !seenCoaching

  return {
    showAnalysesHint,
    showCoachingHint,
    convCount: status?.convCount ?? 0,
    userId,
    dismissAnalysesHint,
    dismissCoachingHint,
  }
}
