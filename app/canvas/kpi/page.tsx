// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'

// ─── TYPES ────────────────────────────────────────────────────────────
type KpiId =
  | 'kpi_verkoopcyclus' | 'kpi_conversieratio' | 'kpi_klantaandeel'
  | 'kpi_klantretentie' | 'kpi_forecast' | 'kpi_ordergrootte'
  | 'kpi_nieuwe_logos' | 'kpi_omzet' | 'kpi_winst' | 'kpi_referrals'

interface KpiDef {
  id: KpiId
  label: string
  suffix?: string
  prefix?: string
  invert?: boolean
}

// ─── KPI CONFIG ───────────────────────────────────────────────────────
const KPIS: KpiDef[] = [
  { id: 'kpi_verkoopcyclus',  label: 'Verkoopcyclus',       suffix: ' dgn', invert: true },
  { id: 'kpi_conversieratio', label: '% Target behaald',    suffix: '%' },
  { id: 'kpi_klantaandeel',   label: '% Klantaandeel',      suffix: '%' },
  { id: 'kpi_klantretentie',  label: '% Klantretentie',     suffix: '%' },
  { id: 'kpi_forecast',       label: '% Behaalde Forecast', suffix: '%' },
  { id: 'kpi_ordergrootte',   label: '€ Gem. Ordergrootte', prefix: '€' },
  { id: 'kpi_nieuwe_logos',   label: "# Nieuwe Logo's" },
  { id: 'kpi_omzet',          label: '€ Omzet',             prefix: '€' },
  { id: 'kpi_winst',          label: '€/% Winst' },
  { id: 'kpi_referrals',      label: '# Referrals' },
]

// ─── HELPERS ──────────────────────────────────────────────────────────
function parse(s: string): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(',', '.').replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}

function fmt(val: number, def: KpiDef): string {
  const n = Math.round(val).toLocaleString('nl-NL')
  if (def.prefix) return `${def.prefix}${n}`
  if (def.suffix) return `${n}${def.suffix}`
  return String(n)
}

function trafficColor(doel: number | null, real: number | null, invert = false): string {
  if (doel === null || real === null || doel === 0) return '#374151'
  const pct = (real / doel) * 100
  if (invert) return pct <= 90 ? '#38a169' : pct <= 100 ? '#dd8800' : '#e53e3e'
  return pct >= 100 ? '#38a169' : pct >= 75 ? '#dd8800' : '#e53e3e'
}

function convColor(v: number | null, red: number, green: number): string {
  if (v === null) return '#374151'
  return v < red ? '#e53e3e' : v > green ? '#38a169' : '#dd8800'
}

// ─── COMPONENTS ───────────────────────────────────────────────────────

function TrafficDot({ color }: { color: string }) {
  return (
    <div style={{
      width: '10px', height: '10px', borderRadius: '50%',
      backgroundColor: color, flexShrink: 0,
      boxShadow: color !== '#374151' ? `0 0 6px ${color}88` : 'none',
    }} />
  )
}

function KpiCard({ def, doel, real }: { def: KpiDef; doel: string; real: string }) {
  const doelN = parse(doel)
  const realN = parse(real)
  const color = trafficColor(doelN, realN, def.invert)
  const hasData = doelN !== null && realN !== null
  const pct = hasData && doelN > 0 ? Math.round((realN! / doelN) * 100) : null

  return (
    <div style={{
      padding: '32px',
      backgroundColor: '#111827',
      border: '1px solid',
      borderColor: hasData ? (color === '#374151' ? '#1e1e1e' : `${color}44`) : '#1e1e1e',
      minHeight: '180px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <TrafficDot color={hasData ? color : '#222'} />
          <span style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '3px', opacity: 0.6 }}>
            {def.label.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ color: '#f1f5f9', fontSize: '10px', letterSpacing: '2px', opacity: 0.25, marginBottom: '6px' }}>DOEL</div>
            <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '36px', color: '#f1f5f9', lineHeight: 1, opacity: doelN !== null ? 1 : 0.15 }}>
              {doelN !== null ? fmt(doelN, def) : '0'}
            </div>
          </div>
          <div>
            <div style={{ color: '#f1f5f9', fontSize: '10px', letterSpacing: '2px', opacity: 0.25, marginBottom: '6px' }}>REALISATIE</div>
            <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '36px', color: hasData ? color : '#f1f5f9', lineHeight: 1, opacity: realN !== null ? 1 : 0.15 }}>
              {realN !== null ? fmt(realN, def) : '0'}
            </div>
          </div>
        </div>
      </div>

      {hasData && doelN! > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ width: '100%', height: '1px', backgroundColor: '#1e293b', marginBottom: '8px' }}>
            <div style={{
              height: '1px',
              width: `${Math.min(pct!, 100)}%`,
              backgroundColor: color,
              transition: 'width 0.8s ease',
            }} />
          </div>
          <span style={{ color, fontSize: '10px', letterSpacing: '2px', opacity: 0.7 }}>
            {pct}% van doel
          </span>
        </div>
      )}
    </div>
  )
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ color: '#f1f5f9', fontSize: '10px', letterSpacing: '3px', opacity: 0.4 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '20px', color: '#f1f5f9', letterSpacing: '2px' }}>
          {Math.round(value).toLocaleString('nl-NL')}
        </span>
      </div>
      <div style={{ height: '2px', backgroundColor: '#1e293b' }}>
        <div style={{ height: '2px', width: `${pct}%`, backgroundColor: color, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

function ConversieRij({ from, to, pct, color }: { from: string; to: string; pct: number | null; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: '1px solid #1e1e1e' }}>
      <TrafficDot color={pct !== null ? color : '#374151'} />
      <span style={{ color: '#f1f5f9', fontSize: '10px', letterSpacing: '2px', opacity: 0.35, flex: 1 }}>
        {from.toUpperCase()} → {to.toUpperCase()}
      </span>
      <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '32px', color: pct !== null ? color : '#374151', letterSpacing: '2px' }}>
        {pct !== null ? `${Math.round(pct)}%` : '0'}
      </span>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────
export default function KpiDashboardPage() {
  const { user } = useUser()
  const supabase = useSupabaseClient()

  const [targets, setTargets] = useState<Record<string, { doel: string; real: string }>>({})
  const [funnel, setFunnel] = useState({ leads: 0, bezoeken: 0, offertes: 0, orders: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase
        .from('canvas_answers')
        .select('question_id, answer')
        .eq('user_id', user.id)
        .like('question_id', 'uitvoering_%')

      if (data) {
        const t: Record<string, { doel: string; real: string }> = {}
        let leads = 0, bezoeken = 0, offertes = 0, orders = 0

        data.forEach(r => {
          const key = r.question_id.slice('uitvoering_'.length)
          if (key.endsWith('_doel') || key.endsWith('_real')) {
            const type = key.endsWith('_doel') ? 'doel' : 'real'
            const base = key.slice(0, key.lastIndexOf('_'))
            if (!t[base]) t[base] = { doel: '', real: '' }
            t[base][type] = r.answer
          }
          if (key === 'numbers_leads') leads = parseFloat(r.answer) || 0
          if (key === 'numbers_bezoeken') bezoeken = parseFloat(r.answer) || 0
          if (key === 'numbers_offertes') offertes = parseFloat(r.answer) || 0
          if (key === 'numbers_orders') orders = parseFloat(r.answer) || 0
        })

        setTargets(t)
        setFunnel({ leads, bezoeken, offertes, orders })
      }
      setLoading(false)
    })()
  }, [user])

  const conv1 = funnel.leads > 0 ? (funnel.bezoeken / funnel.leads) * 100 : null
  const conv2 = funnel.bezoeken > 0 ? (funnel.offertes / funnel.bezoeken) * 100 : null
  const conv3 = funnel.offertes > 0 ? (funnel.orders / funnel.offertes) * 100 : null

  const statusCounts = { groen: 0, oranje: 0, rood: 0, leeg: 0 }
  KPIS.forEach(def => {
    const d = parse(targets[def.id]?.doel || '')
    const r = parse(targets[def.id]?.real || '')
    if (d === null || r === null) { statusCounts.leeg++; return }
    const c = trafficColor(d, r, def.invert)
    if (c === '#38a169') statusCounts.groen++
    else if (c === '#dd8800') statusCounts.oranje++
    else statusCounts.rood++
  })

  const funnelMax = Math.max(funnel.leads, funnel.bezoeken, funnel.offertes, funnel.orders, 1)
  const totalConv = funnel.leads > 0 ? ((funnel.orders / funnel.leads) * 100).toFixed(1) : null

  if (!user) return null

  return (
    <main style={{
      backgroundColor: '#111827', minHeight: '100vh', color: '#f1f5f9',
      fontFamily: 'var(--font-geist-sans), sans-serif',
    }}>

      {/* TERUG NAV */}
      <nav style={{ position: 'sticky' as const, top: 0, zIndex: 100, background: '#f5f0e8', borderBottom: '1px solid #e0d8cc', padding: '0 40px', display: 'flex', alignItems: 'center', height: 103, fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '3px' }}>
        <Link href="/canvas" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '3px', color: '#1a1714', textDecoration: 'none', opacity: 0.4 }}>← CANVAS</Link>
      </nav>

      {/* HEADER */}
      <div style={{ borderBottom: '1px solid #1f1f1f', padding: '48px 40px 40px' }}>
        <p style={{ color: '#f59e0b', fontSize: '13px', letterSpacing: '0.05em', marginBottom: '8px', opacity: 1, fontFamily: 'Geist, system-ui, sans-serif', textTransform: 'uppercase' as const }}>
          ROYAL DUTCH SALES
        </p>
        <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(48px, 7vw, 96px)', fontWeight: 400, letterSpacing: '0.02em', color: '#f1f5f9', margin: '0 0 8px 0', lineHeight: 1 }}>
          KPI DASHBOARD
        </h1>
        <p style={{ color: 'rgb(136,136,136)', opacity: 1, fontSize: '13px', letterSpacing: '0.03em', fontFamily: 'Geist, system-ui, sans-serif', textTransform: 'uppercase' as const, marginTop: 12 }}>
          {user.firstName} · DOELEN VS. REALISATIE {new Date().getFullYear()}
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '64px 48px', color: '#f1f5f9', opacity: 0.2, fontSize: '11px', letterSpacing: '3px' }}>LADEN...</div>
      ) : (
        <div style={{ padding: '64px 48px' }}>
          {/* STATUS SAMENVATTING */}
          <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: '48px', marginBottom: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px', marginBottom: '32px' }}>
              <span style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '4px' }}>KPI STATUS</span>
            </div>
            <div style={{ display: 'flex', gap: '64px' }}>
              {[
                { label: 'GROEN', count: statusCounts.groen, color: '#38a169' },
                { label: 'ORANJE', count: statusCounts.oranje, color: '#dd8800' },
                { label: 'ROOD', count: statusCounts.rood, color: '#e53e3e' },
                { label: 'LEEG', count: statusCounts.leeg, color: '#374151' },
              ].map(({ label, count, color }) => (
                <div key={label}>
                  <p style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '3px', marginBottom: '6px', opacity: 0.6 }}>{label}</p>
                  <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '64px', color, lineHeight: 1, letterSpacing: '2px' }}>
                    {count}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* KPI KAARTEN */}
          <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: '48px', marginBottom: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px', marginBottom: '32px' }}>
              <span style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '4px' }}>KPI METERS</span>
              <span style={{ color: '#f1f5f9', fontSize: '10px', opacity: 0.2, letterSpacing: '2px' }}>
                KPI's aanpassen via{' '}
                <Link href="/canvas/uitvoering" style={{ color: '#f59e0b', opacity: 0.6, textDecoration: 'none' }}>
                  UITVOERING
                </Link>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
              {KPIS.map(def => (
                <KpiCard
                  key={def.id}
                  def={def}
                  doel={targets[def.id]?.doel || ''}
                  real={targets[def.id]?.real || ''}
                />
              ))}
            </div>
          </div>

          {/* SALES FUNNEL + CONVERSIES */}
          <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: '48px', marginBottom: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px', marginBottom: '48px' }}>
              <span style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '4px' }}>SALES FUNNEL</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px' }}>
              {/* Funnel bars */}
              <div>
                <FunnelBar label="LEADS" value={funnel.leads} max={funnelMax} color="#f59e0b" />
                <FunnelBar label="BEZOEKEN" value={funnel.bezoeken} max={funnelMax} color="#dd8800" />
                <FunnelBar label="OFFERTES" value={funnel.offertes} max={funnelMax} color="#e07000" />
                <FunnelBar label="ORDERS" value={funnel.orders} max={funnelMax} color="#c05800" />
              </div>

              {/* Conversies */}
              <div>
                <ConversieRij from="Leads" to="Bezoeken" pct={conv1} color={convColor(conv1, 20, 40)} />
                <ConversieRij from="Bezoeken" to="Offertes" pct={conv2} color={convColor(conv2, 30, 50)} />
                <ConversieRij from="Offertes" to="Orders" pct={conv3} color={convColor(conv3, 30, 50)} />

                {totalConv !== null && (
                  <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '1px solid #1e1e1e' }}>
                    <p style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '3px', marginBottom: '8px', opacity: 0.6 }}>
                      TOTALE CONVERSIE
                    </p>
                    <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '96px', color: '#f59e0b', lineHeight: 1, letterSpacing: '2px' }}>
                      {totalConv}%
                    </div>
                    <p style={{ color: '#f1f5f9', fontSize: '10px', opacity: 0.25, letterSpacing: '2px', marginTop: '8px' }}>
                      VAN LEAD NAAR ORDER
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
