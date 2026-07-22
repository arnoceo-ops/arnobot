'use client'

import { useState } from 'react'

export default function SearchLinkedIn({ userId, name, email, hasLinkedin }: { userId: string; name: string; email?: string; hasLinkedin: boolean }) {
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function search() {
    setLoading(true)
    setNotFound(false)
    try {
      const res = await fetch('/api/bot/search-linkedin-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name, email }),
      })
      const data = await res.json()
      if (data.linkedinUrl) {
        setFound(data.linkedinUrl)
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    }
    setLoading(false)
  }

  async function saveManual() {
    if (!inputValue.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/bot/set-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, linkedinUrl: inputValue.trim() }),
      })
      const data = await res.json()
      if (data.linkedinUrl) {
        setFound(data.linkedinUrl)
        setShowInput(false)
      }
    } catch {}
    setSaving(false)
  }

  if (hasLinkedin) return null

  if (found) {
    return (
      <a href={found} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: '12px', letterSpacing: '2px', color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>
        LI →
      </a>
    )
  }

  if (showInput) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        <input
          autoFocus
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveManual(); if (e.key === 'Escape') setShowInput(false) }}
          placeholder="linkedin.com/in/..."
          style={{
            fontSize: '12px', padding: '4px 8px', borderRadius: 4,
            border: '1px solid #374151', background: '#111827',
            color: '#f1f5f9', width: 160, outline: 'none',
          }}
        />
        <button
          onClick={saveManual}
          disabled={saving || !inputValue.trim()}
          style={{ fontSize: '12px', letterSpacing: '2px', color: '#22c55e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {saving ? '...' : 'OPSLAAN'}
        </button>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        <span style={{ fontSize: '12px', letterSpacing: '1px', color: '#cc2200', fontWeight: 700 }}>NIET GEVONDEN</span>
        <button
          onClick={() => setShowInput(true)}
          style={{ fontSize: '12px', letterSpacing: '2px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          HANDMATIG
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={search}
      disabled={loading}
      style={{
        fontSize: '12px', letterSpacing: '2px', color: '#f59e0b',
        background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
        fontWeight: 700, padding: 0,
      }}
    >
      {loading ? '...' : 'ZOEK LI'}
    </button>
  )
}
