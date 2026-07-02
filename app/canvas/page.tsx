// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PdfExportButton from '@/components/PdfExportButton'

const TOTAL_FIELDS = {
  strategie: ['missie','cultuur_1','cultuur_2','cultuur_3','cultuur_4','cultuur_5','waardepropositie','kerncompetenties','dienstverlening','zandbak','doelen_datum','doelen_omzet','doelen_winst','doelen_klanten','doelen_marktaandeel','doelen_liquiditeit','acties_datum','acties_omzet','acties_winst','acties_brutomarge','acties_cash','acties_klanten','leiderschap_markten','leiderschap_wanneer','merkbelofte','strategie_1_zin','onderscheidend_1','onderscheidend_2','onderscheidend_3','onderscheidend_4','onderscheidend_5','xfactor','winst_per_eenheid','moonshots','schaalbaarheid','repeterende_omzet','klantretentie','referrals','omtm'],
  mensen: ['aantrekkingskracht','profielen','wervingskanalen','selectieproces','behoud_sterspelers','verkopers_q1','verkopers_q2','verkopers_q3','verkopers_q4','werving_selectie','onboarding','tijd_rendement','actieplan'],
  uitvoering: ['kwartaal_jaar','themanaam','meetbaar_doel','cruciale_kpi','okr_wat_1','okr_hoe_1','okr_wie_1','okr_wat_2','okr_hoe_2','okr_wie_2','okr_wat_3','okr_hoe_3','okr_wie_3','klanten_krijgen_1','klanten_krijgen_2','klanten_krijgen_3','klanten_uitbouwen_1','klanten_uitbouwen_2','klanten_uitbouwen_3','klanten_houden_1','klanten_houden_2','klanten_houden_3','numbers_leads','numbers_bezoeken','numbers_offertes','numbers_orders','numbers_referrals','conversie_leads_bezoeken','conversie_bezoeken_offertes','conversie_offertes_orders','wensenlijst','kpi_verkoopcyclus','kpi_conversieratio','kpi_klantaandeel','kpi_klantretentie','kpi_forecast','kpi_ordergrootte','kpi_nieuwe_logos','kpi_omzet','kpi_winst','kpi_referrals','verkoopproces','feestje','beloning'],
}

const ALL_TOTAL = Object.values(TOTAL_FIELDS).flat().length

const WEIGHTS = { strategie: 0.30, mensen: 0.40, uitvoering: 0.30 }

const QUESTION_WEIGHTS: Record<string, number> = {
  strategie_missie: 3, strategie_waardepropositie: 3, strategie_strategie_1_zin: 3,
  strategie_xfactor: 3, strategie_merkbelofte: 3, strategie_kerncompetenties: 3,
  strategie_onderscheidend_1: 3, strategie_onderscheidend_2: 3, strategie_onderscheidend_3: 3,
  strategie_onderscheidend_4: 3, strategie_onderscheidend_5: 3,
  strategie_zandbak: 2, strategie_dienstverlening: 2, strategie_moonshots: 2,
  strategie_schaalbaarheid: 2, strategie_repeterende_omzet: 2, strategie_klantretentie: 2,
  strategie_referrals: 2, strategie_omtm: 2, strategie_winst_per_eenheid: 2,
  strategie_leiderschap_markten: 2, strategie_leiderschap_wanneer: 2,
  strategie_cultuur_1: 2, strategie_cultuur_2: 2, strategie_cultuur_3: 2,
  strategie_cultuur_4: 2, strategie_cultuur_5: 2,
  strategie_doelen_omzet: 2, strategie_doelen_winst: 2, strategie_doelen_klanten: 2,
  strategie_doelen_marktaandeel: 2, strategie_doelen_liquiditeit: 2,
  strategie_acties_omzet: 2, strategie_acties_winst: 2, strategie_acties_brutomarge: 2,
  strategie_acties_cash: 2, strategie_acties_klanten: 2,
  strategie_doelen_datum: 1, strategie_acties_datum: 1,
  mensen_aantrekkingskracht: 3, mensen_profielen: 3, mensen_behoud_sterspelers: 3,
  mensen_onboarding: 3, mensen_actieplan: 3,
  mensen_wervingskanalen: 2, mensen_selectieproces: 2, mensen_werving_selectie: 2,
  mensen_tijd_rendement: 2,
  mensen_verkopers_q1: 1, mensen_verkopers_q2: 1, mensen_verkopers_q3: 1, mensen_verkopers_q4: 1,
  uitvoering_themanaam: 3, uitvoering_meetbaar_doel: 3, uitvoering_cruciale_kpi: 3,
  uitvoering_verkoopproces: 3,
  uitvoering_okr_wat_1: 3, uitvoering_okr_wat_2: 3, uitvoering_okr_wat_3: 3,
  uitvoering_okr_hoe_1: 3, uitvoering_okr_hoe_2: 3, uitvoering_okr_hoe_3: 3,
  uitvoering_wensenlijst: 2,
  uitvoering_klanten_krijgen_1: 2, uitvoering_klanten_krijgen_2: 2, uitvoering_klanten_krijgen_3: 2,
  uitvoering_klanten_uitbouwen_1: 2, uitvoering_klanten_uitbouwen_2: 2, uitvoering_klanten_uitbouwen_3: 2,
  uitvoering_klanten_houden_1: 2, uitvoering_klanten_houden_2: 2, uitvoering_klanten_houden_3: 2,
  uitvoering_kpi_verkoopcyclus: 2, uitvoering_kpi_conversieratio: 2, uitvoering_kpi_klantaandeel: 2,
  uitvoering_kpi_klantretentie: 2, uitvoering_kpi_forecast: 2, uitvoering_kpi_ordergrootte: 2,
  uitvoering_kpi_nieuwe_logos: 2, uitvoering_kpi_omzet: 2, uitvoering_kpi_winst: 2,
  uitvoering_kpi_referrals: 2,
  uitvoering_okr_wie_1: 1, uitvoering_okr_wie_2: 1, uitvoering_okr_wie_3: 1,
  uitvoering_numbers_leads: 1, uitvoering_numbers_bezoeken: 1, uitvoering_numbers_offertes: 1,
  uitvoering_numbers_orders: 1, uitvoering_numbers_referrals: 1,
  uitvoering_conversie_leads_bezoeken: 1, uitvoering_conversie_bezoeken_offertes: 1,
  uitvoering_conversie_offertes_orders: 1,
  uitvoering_kwartaal_jaar: 1, uitvoering_feestje: 1, uitvoering_beloning: 1,
}

function getQuestionWeight(question_id: string): number {
  return QUESTION_WEIGHTS[question_id] ?? 2
}

function getScoreLabel(score: number) {
  if (score < 25) return 'ONVOLLEDIG'
  if (score < 50) return 'IN OPBOUW'
  if (score < 75) return 'GEVORDERD'
  if (score < 100) return 'BIJNA KLAAR'
  return 'COMPLEET'
}

function getKwaliteitLabel(score: number | null) {
  if (score === null) return ''
  if (score < 25) return 'ZWAK'
  if (score < 50) return 'MATIG'
  if (score < 75) return 'SOLIDE'
  if (score < 90) return 'STERK'
  return 'UITSTEKEND'
}

const SECTIONS = [
  { key: 'strategie' as const, pages: '01-02', title: 'STRATEGIE' },
  { key: 'mensen' as const, pages: '03-04', title: 'MENSEN' },
  { key: 'uitvoering' as const, pages: '05-06', title: 'UITVOERING' },
]

function berekenGewogenScore(rows: { question_id: string; score: number }[]): number {
  if (rows.length === 0) return 0
  let totalWeight = 0
  let weightedSum = 0
  for (const row of rows) {
    const w = getQuestionWeight(row.question_id)
    weightedSum += (row.score / 5) * w
    totalWeight += w
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

function berekenKwaliteitsScore(data: { question_id: string; score: number | null }[]): number {
  const scored = data.filter(r => r.score !== null && r.score !== undefined) as { question_id: string; score: number }[]
  const segRows: Record<string, { question_id: string; score: number }[]> = {
    strategie: [], mensen: [], uitvoering: []
  }
  for (const row of scored) {
    const seg = row.question_id.split('_')[0]
    if (segRows[seg]) segRows[seg].push(row)
  }
  const weighted =
    berekenGewogenScore(segRows.strategie) * WEIGHTS.strategie +
    berekenGewogenScore(segRows.mensen) * WEIGHTS.mensen +
    berekenGewogenScore(segRows.uitvoering) * WEIGHTS.uitvoering
  return Math.round(weighted * 100)
}

function formatTimestamp(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) +
    ' om ' + date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export default function CanvasPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [scores, setScores] = useState({ strategie: 0, mensen: 0, uitvoering: 0 })
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<string | null>(null)
  const [approved, setApproved] = useState<boolean | null>(null)
  const [isManager, setIsManager] = useState(false)

  const [kwaliteitsScore, setKwaliteitsScore] = useState<number | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [analyseProgress, setAnalyseProgress] = useState<string>('')
  const [laatsteAnalyse, setLaatsteAnalyse] = useState<Date | null>(null)

  useEffect(() => {
    if (isLoaded && !user) router.push('/sign-in')
  }, [isLoaded, user, router])

  useEffect(() => {
    if (!user) return
    const checkApproval = async () => {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('approved_users')
        .select('id, expires_at, is_manager')
        .eq('user_id', user.id)
        .single()
      if (!data) { setApproved(false); return }
      if (data.expires_at && data.expires_at < now) { setApproved(false); return }
      setApproved(true)
      setIsManager(!!data.is_manager)
    }
    checkApproval()
  }, [user])

  useEffect(() => {
    if (!user || approved !== true) return
    const load = async () => {
      const allIds = [
        ...TOTAL_FIELDS.strategie.map(id => `strategie_${id}`),
        ...TOTAL_FIELDS.mensen.map(id => `mensen_${id}`),
        ...TOTAL_FIELDS.uitvoering.map(id => `uitvoering_${id}`),
      ]
      const { data } = await supabase
        .from('canvas_answers')
        .select('question_id, answer, score')
        .eq('user_id', user.id)
        .in('question_id', allIds)

      if (data) {
        const filled = new Set(data.filter(r => r.answer?.trim()).map(r => r.question_id))
        setScores({
          strategie: TOTAL_FIELDS.strategie.filter(id => filled.has(`strategie_${id}`)).length,
          mensen: TOTAL_FIELDS.mensen.filter(id => filled.has(`mensen_${id}`)).length,
          uitvoering: TOTAL_FIELDS.uitvoering.filter(id => filled.has(`uitvoering_${id}`)).length,
        })
        const scored = data.filter(r => r.score !== null && r.score !== undefined)
        if (scored.length > 0) {
          setKwaliteitsScore(berekenKwaliteitsScore(data))
        }
      }
      setLoading(false)
    }
    load()
  }, [user, approved])

  // Analyseer plan — scoort ALLE antwoorden opnieuw (ook bestaande scores)
  const analyseerPlan = async () => {
    if (!user) return
    setAnalysing(true)
    setAnalyseProgress('Antwoorden ophalen...')

    const allIds = [
      ...TOTAL_FIELDS.strategie.map(id => `strategie_${id}`),
      ...TOTAL_FIELDS.mensen.map(id => `mensen_${id}`),
      ...TOTAL_FIELDS.uitvoering.map(id => `uitvoering_${id}`),
    ]

    const { data: answers } = await supabase
      .from('canvas_answers')
      .select('question_id, answer')
      .eq('user_id', user.id)
      .in('question_id', allIds)

    const toScore = (answers ?? []).filter(r => r.answer?.trim())

    if (toScore.length === 0) {
      setAnalyseProgress('Geen antwoorden gevonden.')
      setAnalysing(false)
      return
    }

    let done = 0
    for (const row of toScore) {
      setAnalyseProgress(`Analyseren ${++done} / ${toScore.length}...`)
      try {
        const res = await fetch('/api/arnobot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'score', questionId: row.question_id, answer: row.answer }),
        })
        const { score } = await res.json()
        if (score) {
          await supabase
            .from('canvas_answers')
            .update({ score })
            .eq('user_id', user.id)
            .eq('question_id', row.question_id)
        }
      } catch {
        // skip bij fout
      }
    }

    setAnalyseProgress('Score berekenen...')
    const { data: allScored } = await supabase
      .from('canvas_answers')
      .select('question_id, score')
      .eq('user_id', user.id)
      .not('score', 'is', null)

    if (allScored) {
      setKwaliteitsScore(berekenKwaliteitsScore(allScored))
    }

    const nu = new Date()
    setLaatsteAnalyse(nu)
    setAnalyseProgress('')
    setAnalysing(false)
  }

  const totalFilled = scores.strategie + scores.mensen + scores.uitvoering
  const healthScore = Math.round((totalFilled / ALL_TOTAL) * 100)
  const scoreLabel = getScoreLabel(healthScore)
  const sectionScore = (segment: keyof typeof TOTAL_FIELDS) =>
    Math.round((scores[segment] / TOTAL_FIELDS[segment].length) * 100)

  if (!isLoaded || !user) return null

  if (approved === false) {
    return (
      <main style={{
        backgroundColor: '#111827', minHeight: '100vh', color: '#f1f5f9',
        fontFamily: 'var(--font-geist-sans), sans-serif',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '64px 48px', textAlign: 'center',
      }}>
        <p style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '4px', marginBottom: '24px', opacity: 0.7 }}>
          ROYAL DUTCH SALES
        </p>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '64px', letterSpacing: '4px', color: '#f1f5f9', margin: '0 0 24px 0', lineHeight: 1 }}>
          TOEGANG AANVRAGEN
        </h1>
        <p style={{ color: '#f1f5f9', opacity: 0.4, fontSize: '15px', maxWidth: '480px', lineHeight: 1.8, marginBottom: '40px' }}>
          Jouw account wacht op goedkeuring. Neem contact op via{' '}
          <a href="mailto:arno@royaldutchsales.com" style={{ color: '#f59e0b', textDecoration: 'none' }}>
            arno@royaldutchsales.com
          </a>{' '}
          om toegang te krijgen tot RDS Canvas.
        </p>
        <Link href="/" style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '3px', textDecoration: 'none', opacity: 0.6 }}>
          ← TERUG NAAR HOME
        </Link>
      </main>
    )
  }

  if (approved === null) return null

  return (
    <main style={{
      backgroundColor: '#111827', minHeight: '100vh', color: '#f1f5f9',
      fontFamily: 'var(--font-geist-sans), sans-serif',
    }}>
      {/* NAV */}
      <nav style={{ position: 'sticky' as const, top: 0, zIndex: 100, background: '#f5f0e8', borderBottom: '1px solid #e0d8cc', padding: '0 40px', display: 'flex', alignItems: 'center', gap: '16px', height: 103, fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '3px' }}>
        {[
          { href: '/canvas', label: 'CANVAS' },
          { href: '/canvas/strategie', label: 'STRATEGIE' },
          { href: '/canvas/mensen', label: 'MENSEN' },
          { href: '/canvas/uitvoering', label: 'UITVOERING' },
          { href: '/canvas/kpi', label: "KPI'S" },
        ].map(({ href, label }, i) => (
          <React.Fragment key={href}>
            {i > 0 && <span style={{ color: '#1a1714', opacity: 0.2 }}>/</span>}
            <Link href={href} style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '3px', color: href === '/canvas' ? '#f59e0b' : '#1a1714', textDecoration: 'none', opacity: href === '/canvas' ? 1 : 0.4 }}>
              {label}
            </Link>
          </React.Fragment>
        ))}
        <span style={{ color: '#1a1714', opacity: 0.2 }}>/</span>
        {isManager ? (
          <Link href="/canvas/team" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '3px', color: '#1a1714', textDecoration: 'none', opacity: 0.4 }}>
            TEAM
          </Link>
        ) : (
          <span title="Geen team-account" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '3px', color: '#1a1714', opacity: 0.15, cursor: 'default' }}>
            TEAM
          </span>
        )}
      </nav>

      {/* HEADER */}
      <div style={{ padding: '64px 48px 0', marginBottom: '80px' }}>
        <p style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '4px', marginBottom: '12px', opacity: 0.7 }}>
          ROYAL DUTCH SALES
        </p>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '96px', letterSpacing: '6px', color: '#f1f5f9', margin: '0 0 8px 0', lineHeight: 1 }}>
          RDS CANVAS
        </h1>
        <p style={{ color: '#f1f5f9', opacity: 0.35, fontSize: '13px', letterSpacing: '1px' }}>
          {user.firstName} · Verkoopplan {new Date().getFullYear()}
        </p>
      </div>

      {/* SCORES BLOK */}
      <div style={{ padding: '0 48px', borderTop: '1px solid #1e1e1e', paddingTop: '48px', marginBottom: '80px' }}>

        {/* Volledigheid */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px', marginBottom: '16px' }}>
            <span style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '4px' }}>VOLLEDIGHEID</span>
            <span style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '2px', opacity: 0.4 }}>
              {loading ? '...' : scoreLabel}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '120px', color: '#f1f5f9', lineHeight: 1, marginBottom: '24px', letterSpacing: '2px' }}>
            {loading ? '...' : `${healthScore}%`}
          </div>
          <div style={{ width: '100%', height: '2px', backgroundColor: '#1e293b', marginBottom: '32px' }}>
            <div style={{ height: '2px', width: loading ? '0%' : `${healthScore}%`, backgroundColor: '#f59e0b', transition: 'width 1s ease' }} />
          </div>
        </div>

        {/* Kwaliteitsscore */}
        <div style={{ marginBottom: '48px', paddingTop: '32px', borderTop: '1px solid #1e1e1e' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px', marginBottom: '16px' }}>
            <span style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '4px' }}>PLAN KWALITEIT</span>
            {kwaliteitsScore !== null && (
              <span style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '2px', opacity: 0.4 }}>
                {getKwaliteitLabel(kwaliteitsScore)}
              </span>
            )}
            <span style={{ color: '#f1f5f9', fontSize: '10px', letterSpacing: '2px', opacity: 0.25, marginLeft: 'auto' }}>
              MENSEN 40% · STRATEGIE 30% · UITVOERING 30%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '40px' }}>
            <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '120px', color: kwaliteitsScore !== null ? '#f1f5f9' : '#1e1e1e', lineHeight: 1, letterSpacing: '2px' }}>
              {kwaliteitsScore !== null ? `${kwaliteitsScore}%` : '0%'}
            </div>

            <div style={{ paddingBottom: '16px' }}>
              <button
                onClick={analyseerPlan}
                disabled={analysing}
                style={{
                  padding: '12px 28px',
                  backgroundColor: analysing ? '#1e293b' : '#f59e0b',
                  color: analysing ? '#4b5563' : '#111827',
                  border: 'none',
                  fontFamily: 'var(--font-bebas), sans-serif',
                  fontSize: '18px',
                  letterSpacing: '3px',
                  cursor: analysing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {analysing ? (analyseProgress || 'ANALYSEREN...') : 'ANALYSEER PLAN'}
              </button>
              {laatsteAnalyse && !analysing && (
                <p style={{ color: '#f1f5f9', fontSize: '10px', opacity: 0.25, letterSpacing: '2px', marginTop: '8px' }}>
                  LAATSTE ANALYSE: {formatTimestamp(laatsteAnalyse)}
                </p>
              )}
            </div>
          </div>

          {kwaliteitsScore !== null && (
            <div style={{ width: '100%', height: '2px', backgroundColor: '#1e293b', marginTop: '16px' }}>
              <div style={{ height: '2px', width: `${kwaliteitsScore}%`, backgroundColor: '#f59e0b', transition: 'width 1s ease' }} />
            </div>
          )}
        </div>

        {/* Sectie breakdown + PDF */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '64px' }}>
            {SECTIONS.map(s => (
              <div key={s.key}>
                <p style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '3px', marginBottom: '6px' }}>{s.title}</p>
                <p style={{ color: '#f1f5f9', fontSize: '13px', opacity: 0.5, letterSpacing: '1px' }}>
                  {loading ? '...' : `${scores[s.key]} / ${TOTAL_FIELDS[s.key].length}`}
                </p>
              </div>
            ))}
          </div>
          <PdfExportButton />
        </div>
      </div>

      {/* SECTIE KAARTEN */}
      <div style={{ padding: '0 48px 64px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
        {SECTIONS.map(s => {
          const pct = sectionScore(s.key)
          const isHovered = hovered === s.key
          const isComplete = pct === 100
          return (
            <Link key={s.key} href={`/canvas/${s.key}`} style={{ textDecoration: 'none' }}>
              <div
                onMouseEnter={() => setHovered(s.key)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  padding: '40px 32px',
                  backgroundColor: isHovered ? '#1f2937' : '#111827',
                  border: '1px solid',
                  borderColor: isComplete ? '#f59e0b' : isHovered ? '#4b5563' : '#1e1e1e',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  minHeight: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '3px', marginBottom: '12px', opacity: 0.6 }}>{s.pages}</p>
                  <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', color: '#f1f5f9', fontSize: '48px', letterSpacing: '3px', margin: '0 0 8px 0', lineHeight: 1 }}>
                    {s.title}
                  </h2>
                  <p style={{ color: '#f1f5f9', opacity: 0.3, fontSize: '12px', letterSpacing: '1px' }}>
                    {TOTAL_FIELDS[s.key].length} velden
                  </p>
                </div>
                {!loading && (
                  <div style={{ marginTop: '32px' }}>
                    <div style={{ width: '100%', height: '1px', backgroundColor: '#1e1e1e', marginBottom: '10px' }}>
                      <div style={{ height: '1px', width: `${pct}%`, backgroundColor: '#f59e0b', transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '2px', opacity: 0.5 }}>{pct}%</span>
                      {isHovered && (
                        <span style={{ color: '#f59e0b', fontSize: '10px', letterSpacing: '2px', opacity: 0.5 }}>OPEN →</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}