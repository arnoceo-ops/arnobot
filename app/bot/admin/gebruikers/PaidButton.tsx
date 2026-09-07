'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

type Action = 'paid' | 'comp' | 'active'
const PANEL_W = 190

export default function PaidButton({
  userId,
  paidAt,
  expiresAt,
  isActive,
}: {
  userId: string
  paidAt: string | null
  expiresAt: string | null
  isActive: boolean
}) {
  const router = useRouter()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [paid, setPaid] = useState(!!paidAt)
  const [comped, setComped] = useState(!paidAt && !!expiresAt)
  // De datum die de cel toont is altijd expires_at, nooit paid_at. Een betaler
  // zonder expires_at heeft onbeperkte toegang (proxy.ts: paid_at wint), dan hoort
  // er geen "t/m"-datum bij.
  const [shownExpiry, setShownExpiry] = useState<string | null>(expiresAt ?? null)
  const [active, setActive] = useState(isActive)
  const [expires, setExpires] = useState(expiresAt ? expiresAt.slice(0, 10) : '')
  const [loading, setLoading] = useState<Action | ''>('')
  // Vaste positie i.p.v. absolute: de tabel zit in een overflow-container die het
  // paneel anders bij de onderste rijen afknipt.
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null)

  function toggle() {
    if (pos) { setPos(null); return }
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return
    const dropUp = window.innerHeight - r.bottom < 300
    setPos({
      left: Math.max(8, Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 8)),
      ...(dropUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }

  async function run(action: Action) {
    if (action === 'comp' && !expires) return
    setLoading(action)
    try {
      let res: Response
      if (action === 'active') {
        res = await fetch('/api/admin/active', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, active: !active }),
        })
      } else {
        const iso = expires ? new Date(expires).toISOString() : null
        res = await fetch(action === 'paid' ? '/api/admin/payment' : '/api/admin/comp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(iso ? { userId, expiresAt: iso } : { userId }),
        })
        if (res.ok) {
          if (action === 'paid') { setPaid(true); setComped(false); setShownExpiry(iso) }
          if (action === 'comp') { setComped(true); setPaid(false); setShownExpiry(iso) }
        }
      }
      if (!res.ok) return
      if (action === 'active') setActive(a => !a)
      setPos(null)
      router.refresh()
    } finally {
      setLoading('')
    }
  }

  const label: { top: string; sub: string | null; color: string } = !active
    ? { top: 'UIT', sub: null, color: '#6b7280' }
    : paid
    ? { top: 'BETAALD', sub: shownExpiry ? `t/m ${fmtDate(shownExpiry)}` : null, color: '#22c55e' }
    : comped && shownExpiry
    ? { top: 'GRATIS', sub: `t/m ${fmtDate(shownExpiry)}`, color: '#22c55e' }
    : { top: 'TOEGANG +', sub: null, color: '#9ca3af' }

  const showAsPill = !label.sub

  return (
    <div ref={wrapRef} style={{ display: 'inline-block' }}>
      <button
        onClick={toggle}
        style={{
          background: 'transparent', border: showAsPill ? '1px solid #374151' : 'none',
          borderRadius: showAsPill ? 999 : 0, padding: showAsPill ? '3px 8px' : 0,
          cursor: 'pointer', textAlign: 'right', whiteSpace: 'nowrap',
        }}
      >
        <span style={{
          fontSize: '12px', letterSpacing: showAsPill ? '1px' : '2px', fontWeight: 700,
          color: label.color, display: 'block',
        }}>{label.top}</span>
        {label.sub && <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginTop: 2 }}>{label.sub}</span>}
      </button>

      {pos && (
        <>
          <div onClick={() => setPos(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div style={{
            position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, zIndex: 31,
            width: PANEL_W, padding: 10, borderRadius: 6,
            background: '#111827', border: '1px solid #374151',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <label style={{ fontSize: '12px', letterSpacing: '2px', color: '#6b7280' }}>TOEGANG T/M</label>
            <input
              type="date"
              value={expires}
              onChange={e => setExpires(e.target.value)}
              style={{
                fontSize: '12px', padding: '4px 6px', background: '#1f2937',
                border: '1px solid #374151', color: '#f1f5f9', borderRadius: 4, width: '100%',
              }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>leeg = onbeperkt (alleen bij betaald)</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => run('comp')} disabled={!expires || loading !== ''}
                style={{
                  flex: 1, fontSize: '12px', letterSpacing: '1px', fontWeight: 700,
                  padding: '5px 0', borderRadius: 999, border: 'none',
                  cursor: !expires || loading !== '' ? 'not-allowed' : 'pointer',
                  background: expires ? '#22c55e' : '#374151', color: expires ? '#111827' : '#6b7280',
                }}>
                {loading === 'comp' ? '...' : 'GRATIS'}
              </button>
              <button onClick={() => run('paid')} disabled={loading !== ''}
                style={{
                  flex: 1, fontSize: '12px', letterSpacing: '1px', fontWeight: 700,
                  padding: '5px 0', borderRadius: 999, border: 'none',
                  cursor: loading !== '' ? 'not-allowed' : 'pointer',
                  background: '#f59e0b', color: '#111827',
                }}>
                {loading === 'paid' ? '...' : 'BETAALD'}
              </button>
            </div>

            <div style={{ borderTop: '1px solid #374151', paddingTop: 8 }}>
              <button onClick={() => run('active')} disabled={loading !== ''}
                style={{
                  width: '100%', fontSize: '12px', letterSpacing: '1px', fontWeight: 700,
                  padding: '5px 0', borderRadius: 999,
                  border: `1px solid ${active ? '#cc2200' : '#22c55e'}`,
                  background: 'transparent', color: active ? '#cc2200' : '#22c55e',
                  cursor: loading !== '' ? 'not-allowed' : 'pointer',
                }}>
                {loading === 'active' ? '...' : active ? 'TOEGANG INTREKKEN' : 'HERACTIVEER'}
              </button>
            </div>

            <button onClick={() => setPos(null)}
              style={{
                fontSize: '12px', letterSpacing: '2px', padding: '3px 0', borderRadius: 999,
                border: '1px solid #374151', background: 'transparent', color: '#6b7280', cursor: 'pointer',
              }}>
              SLUIT
            </button>
          </div>
        </>
      )}
    </div>
  )
}
