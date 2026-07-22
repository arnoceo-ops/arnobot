'use client'

import { useState } from 'react'

export default function RssIngestButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<string | null>(null)

  async function trigger() {
    setState('loading')
    setResult(null)
    try {
      const res = await fetch('/api/admin/trigger-rss-ingest', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResult(data.error ?? 'Onbekende fout')
        setState('error')
      } else if (data.new === 0) {
        setResult(data.message ?? 'Geen nieuwe artikelen')
        setState('done')
      } else {
        setResult(`${data.new} artikel${data.new === 1 ? '' : 'en'} toegevoegd, ${data.chunks} chunks aangemaakt`)
        setState('done')
      }
    } catch {
      setResult('Netwerkfout')
      setState('error')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <button
        onClick={trigger}
        disabled={state === 'loading'}
        style={{
          fontFamily: 'sans-serif',
          fontSize: 12,
          letterSpacing: 3,
          padding: '8px 24px',
          borderRadius: 999,
          background: state === 'loading' ? '#374151' : '#f59e0b',
          color: state === 'loading' ? '#6b7280' : '#111827',
          border: 'none',
          cursor: state === 'loading' ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {state === 'loading' ? 'BEZIG...' : 'DRAAI NU →'}
      </button>
      {result && (
        <span style={{
          fontSize: 12,
          color: state === 'error' ? '#cc2200' : '#6b7280',
          letterSpacing: 1,
        }}>
          {result}
        </span>
      )}
    </div>
  )
}
