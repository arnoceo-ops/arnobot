'use client'

import { useState, useEffect } from 'react'

export default function ReferralSection({ inAccount }: { inAccount?: boolean }) {
  const [data, setData] = useState<{ code: string; link: string; referrals: number; converted: number; credit: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/bot/referral')
      .then(r => r.json())
      .then(d => { if (d.code) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function copy() {
    if (!data) return
    navigator.clipboard.writeText(data.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const wrapStyle: React.CSSProperties = inAccount
    ? {}
    : { marginTop: 56, borderTop: '1px solid #374151', paddingTop: 40 }

  const statLabel: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 12 }
  const statValue: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, lineHeight: 1 }

  return (
    <div style={wrapStyle}>
      {!inAccount && (
        <>
          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: '13px', letterSpacing: '4px', marginBottom: '16px', display: 'block' }}>REFERRAL</p>
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, fontWeight: 400, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: 1 }}>Jouw referral code</h3>
        </>
      )}
      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, lineHeight: 1.9, color: '#9ca3af', marginBottom: 24 }}>
        Deel deze link. Nieuwe gebruikers krijgen de eerste maand gratis. Jij ook: per betalende referral ontvang jij één maand gratis (€97 tegoed). Bij 25 betalende referrals word je lid van de ArnoBot Ambassadors Club. Bij 50 betalende referrals krijg je een Lifetime Subscription op ArnoBot. Bij 100 betalende referrals krijg je een aanbieding voor deelname in de ArnoBot Venture. Go, Go Gadget 🚀
      </p>

      {/* Link + kopieerknop */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <code style={{
          flex: 1, background: '#1f2937', border: '1.5px solid #374151',
          borderRadius: 4, padding: '12px 16px', fontSize: 14,
          fontFamily: "'Space Mono', monospace", color: loading ? '#374151' : '#f1f5f9',
          letterSpacing: 2, wordBreak: 'break-all',
        }}>
          {loading ? 'arno.bot/aanmelden?ref=...' : data?.link ?? ''}
        </code>
        <button
          onClick={copy}
          disabled={loading || !data}
          style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3,
            padding: '12px 24px', borderRadius: 999, border: 'none',
            cursor: loading || !data ? 'default' : 'pointer',
            background: copied ? '#374151' : loading ? '#374151' : '#f59e0b',
            color: copied || loading ? '#9ca3af' : '#111827',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
        >
          {copied ? 'GEKOPIEERD ✓' : 'KOPIEER LINK'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 2 }}>
        {[
          { label: 'AANGEMELD', value: loading ? '...' : String(data?.referrals ?? 0) },
          { label: 'BETALEND',  value: loading ? '...' : String(data?.converted ?? 0) },
          { label: 'TEGOED',    value: loading ? '...' : `€${(data?.credit ?? 0).toFixed(0)}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#1f2937', padding: '16px 20px', flex: 1, textAlign: 'center' }}>
            <div style={statLabel}>{label}</div>
            <div style={{ ...statValue, color: loading ? '#374151' : '#f1f5f9' }}>{value}</div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 16 }}>
        <a href="/referrals" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#6b7280', textDecoration: 'none' }}>
          SPELREGELS REFERRALPROGRAMMA →
        </a>
      </p>
    </div>
  )
}
