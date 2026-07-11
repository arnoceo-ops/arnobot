'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MarkReviewedButton({ flagId }: { flagId: number }) {
  const router = useRouter()
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  if (done) return null

  async function markReviewed() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/offtopic-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: flagId }),
      })
      if (res.ok) {
        setDone(true)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={markReviewed}
      disabled={loading}
      style={{
        fontSize: '12px', letterSpacing: '1px', fontWeight: 700,
        padding: '3px 8px', borderRadius: 3, border: '1px solid #374151',
        cursor: loading ? 'wait' : 'pointer', background: 'transparent', color: '#6b7280',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? '...' : 'BEKEKEN'}
    </button>
  )
}
