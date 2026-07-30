'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function KostenLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/arnobot-kosten-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/abacus')
    } else {
      setError('Verkeerd wachtwoord.')
    }
    setLoading(false)
  }

  return (
    <main style={{ background: '#111827', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>
        <p style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '4px', marginBottom: '12px' }}>ARNOBOT</p>
        <h1 style={{ color: '#f1f5f9', fontSize: '48px', fontWeight: 700, margin: '0 0 40px 0', letterSpacing: '-1px' }}>Abacus</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="password"
            placeholder="Wachtwoord"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ background: '#1f2937', border: '1px solid #374151', color: '#f1f5f9', padding: '14px 16px', fontSize: '14px', outline: 'none' }}
          />
          {error && <p style={{ color: '#cc2200', fontSize: '12px', margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ background: loading ? '#374151' : '#f59e0b', color: '#111827', border: 'none', borderRadius: 999, padding: '14px', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '8px' }}
          >
            {loading ? 'INLOGGEN...' : 'INLOGGEN'}
          </button>
        </form>
      </div>
    </main>
  )
}
