'use client'

import { useState } from 'react'

export default function SearchLinkedIn({ userId, name, email, hasLinkedin }: { userId: string; name: string; email?: string; hasLinkedin: boolean }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function search() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/bot/search-linkedin-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name, email }),
      })
      const data = await res.json()
      if (data.linkedinUrl) {
        setResult(data.linkedinUrl)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    }
    setLoading(false)
  }

  if (result) {
    return (
      <a href={result} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: '11px', letterSpacing: '2px', color: '#44cc88', textDecoration: 'none', flexShrink: 0, fontWeight: 700 }}>
        LI ✓
      </a>
    )
  }

  if (hasLinkedin) return null

  return (
    <button
      onClick={search}
      disabled={loading}
      style={{
        fontSize: '11px', letterSpacing: '2px', color: error ? '#cc4444' : '#f59e0b',
        background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
        flexShrink: 0, fontWeight: 700, padding: 0,
      }}
    >
      {loading ? '...' : error ? 'NIET GEVONDEN' : 'ZOEK LI'}
    </button>
  )
}
