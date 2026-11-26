'use client'

import { useState, useEffect } from 'react'
import { useIsMobile } from '@/hooks/useBreakpoint'
import { formatEuro } from '@/lib/billing/geld'

export default function ReferralSection({ inAccount }: { inAccount?: boolean }) {
  const isMobile = useIsMobile()
  const [data, setData] = useState<{ code: string; link: string; referrals: number | null; betalend: number | null; tegoedCent: number | null } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/bot/referral')
      .then(r => r.json())
      .then(d => { if (d.code) setData(d) })
      .catch(() => {})
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

  // Zonder code geen referralblok, ook geen kop: een gratis account krijgt geen code.
  if (!data) return null

  return (
    <div style={wrapStyle}>
      {inAccount && (
        <>
          <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>REFERRAL</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, margin: '0 0 32px 0', lineHeight: 1 }}>JOUW REFERRAL CODE</h1>
        </>
      )}
      {!inAccount && (
        <>
          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: '13px', letterSpacing: '4px', marginBottom: '16px', display: 'block' }}>REFERRAL</p>
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, fontWeight: 400, color: '#f1f5f9', margin: '0 0 8px', letterSpacing: 1 }}>Jouw referral code</h3>
        </>
      )}
      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, lineHeight: 1.9, color: '#9ca3af', marginBottom: 24 }}>
        Wie zich via jouw link aanmeldt en een abonnement neemt, krijgt korting op het eerste jaar of de vierde maand gratis. Jij krijgt tegoed, behalve als die persoon Basic per maand neemt. Mijlpalen: 50 Ambassadors Club, 100 Lifetime Subscription (Solo Pro), 250 aanbod ArnoBot Venture. Go, Go Gadget 🚀
      </p>

      {/* Link + kopieerknop */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        <code style={{
          background: '#1f2937', border: '1.5px solid #374151',
          borderRadius: 4, padding: '12px 16px', fontSize: 14,
          fontFamily: "'Space Mono', monospace", color: '#f1f5f9',
          letterSpacing: 2, wordBreak: 'break-all', display: 'block',
        }}>
          {data.link}
        </code>
        <button
          onClick={copy}
          style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3,
            padding: '12px 36px', borderRadius: 999, border: 'none',
            cursor: 'pointer',
            background: copied ? '#374151' : '#f59e0b',
            color: copied ? '#9ca3af' : '#111827',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
            alignSelf: isMobile ? 'stretch' : 'flex-start',
            textAlign: 'center',
          }}
        >
          {copied ? 'GEKOPIEERD ✓' : 'KOPIEER LINK'}
        </button>
      </div>

      {/* Stats. Alle drie altijd zichtbaar, ook op nul (besluit Arno 26-11), zodat een gebruiker ziet wat hij kan
          verwachten. Berekening: lib/billing/referralCijfers.ts. Alleen een teller die nu niet te berekenen is
          verdwijnt, liever dat dan een nul die niet klopt. */}
      <div style={{ display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
        {[
          ...(data.referrals === null ? [] : [{ label: 'AANGEMELD', value: String(data.referrals) }]),
          ...(data.betalend === null ? [] : [{ label: 'BETALEND', value: String(data.betalend) }]),
          ...(data.tegoedCent === null ? [] : [{ label: 'TEGOED EXCL. BTW', value: formatEuro(data.tegoedCent) }]),
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: '#1f2937', padding: '16px 20px', flex: 1,
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            justifyContent: isMobile ? 'space-between' : 'center',
            alignItems: isMobile ? 'center' : 'center',
            textAlign: isMobile ? 'left' : 'center',
          }}>
            <div style={{ ...statLabel, marginBottom: isMobile ? 0 : 12 }}>{label}</div>
            <div style={{ ...statValue, color: '#f1f5f9' }}>{value}</div>
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
