'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import BotNav from '../BotNav'
import { useUser } from '@clerk/nextjs'
import { ProgressieChart } from '@/app/bot/components/ProgressieChart'
import { computeMsaScore } from '@/lib/msa'

function renderMd(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong style="color:#f1f5f9;font-weight:700">$1</strong>')
    .replace(/\n/g, '<br>')
}

interface CoachingDoc {
  voortgang: string
  mindset_score: number
  mindset_diagnose: string
  mindset_richting: 'stijgend' | 'stabiel' | 'dalend'
  systeem_score: number
  systeem_diagnose: string
  systeem_richting: 'stijgend' | 'stabiel' | 'dalend'
  actie_score: number
  actie_diagnose: string
  actie_richting: 'stijgend' | 'stabiel' | 'dalend'
  ontwikkelpunten: { tekst: string; pijlar: string }[]
  blogs: { title: string; url: string; reden: string }[]
  conversation_count: number
  updated_at?: string
  weinig_voortgang?: boolean
  stagnatie?: boolean
  signalen?: string[]
}

interface Stats {
  sessionCount: number
  totalQuestions: number
  lastSessionDate: string | null
}

interface SavedAnalyse {
  id: string
  created_at: string
  session_count: number
}

interface CoachingHistoryEntry {
  id: string
  created_at: string
  mindset_score: number | null
  mindset_diagnose: string | null
  systeem_score: number | null
  systeem_diagnose: string | null
  actie_score: number | null
  actie_diagnose: string | null
  voortgang: string | null
}

function getReportTitle(entry: CoachingHistoryEntry): string {
  const clean = (entry.voortgang ?? '').replace(/\n/g, ' ').trim()
  if (!clean) return 'Coachingsrapportage'
  if (clean.length <= 80) return clean
  const cut = clean.slice(0, 77)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '...'
}

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

// SCOREGESCHIEDENIS — zet op false om te verbergen
const SCORE_HISTORY_ENABLED = true

interface ScoreEntry {
  mindset_score: number
  systeem_score: number
  actie_score: number
  msa_score: number
  created_at: string
}

interface Props {
  userId: string
  plan: string
  paid: boolean
  gesprekBookedAt: string | null
  showSparren: boolean
}

const PIJLAR_COLOR = '#f1f5f9'

const RICHTING_CONFIG: Record<string, { arrow: string; color: string }> = {
  stijgend: { arrow: '↑', color: '#f59e0b' },
  stabiel:  { arrow: '→', color: '#6b7280' },
  dalend:   { arrow: '↓', color: '#cc2200' },
}

export default function CoachingClient({ userId, plan, paid, gesprekBookedAt, showSparren }: Props) {
  const { user } = useUser()
  const firstName = user?.firstName ?? ''
  const [doc, setDoc] = useState<CoachingDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockReason, setBlockReason] = useState<'te_weinig' | 'te_weinig_voortgang' | 'stagnatie' | 'hoge_scores' | null>(null)
  const [teWeinigCount, setTeWeinigCount] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [analyses, setAnalyses] = useState<SavedAnalyse[]>([])
  const [uitdaging, setUitdaging] = useState<string | null>(null)
  const [scoreHistory, setScoreHistory] = useState<ScoreEntry[]>([])
  const [isTeamMember, setIsTeamMember] = useState(false)
  const [progressSignal, setProgressSignal] = useState<boolean | null>(null)
  const [history, setHistory] = useState<CoachingHistoryEntry[]>([])
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

  useEffect(() => {
    const cacheKey = `arnobot_coaching_doc_${userId}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try { setDoc(JSON.parse(cached)) } catch {}
    }

    fetch('/api/bot/coaching')
      .then(r => r.json())
      .then(data => {
        const c = data.coaching
        if (c && c.mindset_score != null && c.systeem_score != null && c.actie_score != null) {
          // Alleen overschrijven als DB-data nieuwer is dan gecachede data (voorkomt regressie bij DB-update-mismatch)
          const existingCached = localStorage.getItem(cacheKey)
          if (existingCached) {
            try {
              const cached = JSON.parse(existingCached)
              const cachedTs = cached.updated_at ? new Date(cached.updated_at).getTime() : 0
              const dbTs = c.updated_at ? new Date(c.updated_at).getTime() : 0
              if (dbTs >= cachedTs) {
                setDoc(c)
                localStorage.setItem(cacheKey, JSON.stringify(c))
              }
              // DB is ouder dan cache → generatie is nog niet opgeslagen, houd cache
            } catch {
              setDoc(c)
              localStorage.setItem(cacheKey, JSON.stringify(c))
            }
          } else {
            setDoc(c)
            localStorage.setItem(cacheKey, JSON.stringify(c))
          }

          if (c.weinig_voortgang && !c.stagnatie) {
            const precheckKey = `arnobot_coaching_precheck_${userId}_${new Date().toISOString().slice(0, 10)}`
            const cached = localStorage.getItem(precheckKey)
            if (cached !== null) {
              setProgressSignal(cached === 'ja')
            } else {
              fetch('/api/bot/coaching-precheck')
                .then(r => r.json())
                .then(d => {
                  const result = d.hasProgress === true
                  localStorage.setItem(precheckKey, result ? 'ja' : 'nee')
                  setProgressSignal(result)
                })
                .catch(() => setProgressSignal(false))
            }
          }
        } else if (c && !localStorage.getItem(cacheKey)) {
          // oude rij zonder MSA — toon niets, zodat de gebruiker genereert
          setDoc(null)
        }
      })
      .finally(() => setLoading(false))
    fetch('/api/bot/sessions')
      .then(r => r.json())
      .then(data => {
        const sessions = data.sessions ?? []
        setStats({
          sessionCount: sessions.length,
          totalQuestions: sessions.reduce((sum: number, s: { message_count?: number }) => sum + (s.message_count || 0), 0),
          lastSessionDate: sessions[0]?.created_at ?? null,
        })
      })
      .catch(() => {})
    fetch('/api/bot/coaching-analyses')
      .then(r => r.json())
      .then(data => setAnalyses(data.analyses ?? []))
      .catch(() => {})
    fetch('/api/bot/coaching-history')
      .then(r => r.json())
      .then(data => setHistory(data.history ?? []))
      .catch(() => {})

    if (new URLSearchParams(window.location.search).get('previewMember') === '1') {
      setIsTeamMember(true)
    } else {
      fetch('/api/bot/team/status')
        .then(r => r.json())
        .then(d => { if (d.hasTeam && !d.isManager) setIsTeamMember(true) })
        .catch(() => {})
    }

    if (SCORE_HISTORY_ENABLED) {
      fetch('/api/bot/coaching-scores')
        .then(r => r.json())
        .then(data => setScoreHistory(data.scores ?? []))
        .catch(() => {})
    }

    const today = new Date().toISOString().slice(0, 10)
    const uitdagingKey = `arnobot_uitdaging_${today}`
    const cachedUitdaging = localStorage.getItem(uitdagingKey)
    if (cachedUitdaging) {
      setUitdaging(cachedUitdaging)
    } else {
      fetch('/api/bot/uitdaging')
        .then(r => r.json())
        .then(data => {
          if (data.uitdaging) {
            localStorage.setItem(uitdagingKey, data.uitdaging)
            setUitdaging(data.uitdaging)
          }
        })
        .catch(() => {})
    }
  }, [userId])

  async function generate() {
    setGenerating(true)
    setError(null)
    setBlockReason(null)
    try {
      const res = await fetch('/api/bot/coaching', { method: 'POST' })
      const data = await res.json()
      if (data.error === 'te_weinig') {
        setBlockReason('te_weinig')
        setTeWeinigCount(data.count ?? 0)
      } else if (data.error === 'te_weinig_voortgang') {
        setBlockReason('te_weinig_voortgang')
      } else if (data.error === 'stagnatie') {
        setBlockReason('stagnatie')
      } else if (data.error === 'hoge_scores') {
        setBlockReason('hoge_scores')
      } else if (data.coaching) {
        setDoc(data.coaching)
        localStorage.setItem(`arnobot_coaching_doc_${userId}`, JSON.stringify(data.coaching))
        const precheckKey = `arnobot_coaching_precheck_${userId}_${new Date().toISOString().slice(0, 10)}`
        localStorage.removeItem(precheckKey)
        setProgressSignal(null)
        fetch('/api/bot/coaching-history')
          .then(r => r.json())
          .then(d => setHistory(d.history ?? []))
          .catch(() => {})
      } else if (data.error) {
        setError('Er ging iets mis. Probeer opnieuw.')
      }
    } catch {
      setError('Er ging iets mis. Probeer opnieuw.')
    }
    setGenerating(false)
  }

  const isUpToDate = (() => {
    if (!doc?.updated_at) return false
    const docDate = new Date(doc.updated_at)
    const lastSession = stats?.lastSessionDate ? new Date(stats.lastSessionDate) : null
    const lastAnalyse = analyses[0]?.created_at ? new Date(analyses[0].created_at) : null
    return (!lastSession || docDate >= lastSession) && (!lastAnalyse || docDate >= lastAnalyse)
  })()

  const hasMSA = doc?.mindset_score != null && doc?.systeem_score != null && doc?.actie_score != null

  const msaScore = hasMSA
    ? computeMsaScore(doc!.mindset_score, doc!.systeem_score, doc!.actie_score)
    : null

  const msaPijlars = hasMSA ? [
    { key: 'mindset', label: 'MINDSET', score: doc!.mindset_score, richting: doc!.mindset_richting },
    { key: 'systeem', label: 'SYSTEEM', score: doc!.systeem_score, richting: doc!.systeem_richting },
    { key: 'actie',   label: 'ACTIE',   score: doc!.actie_score,   richting: doc!.actie_richting   },
  ] : []

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        @keyframes fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }

        .coaching-section { padding: 48px 0; border-top: 1px solid #374151; animation: fadein 0.4s ease; }
        .coaching-label { font-family: 'Space Mono', monospace; font-size: 13px; font-weight: 400; letter-spacing: 4px; color: #f59e0b; display: block; margin-bottom: 16px; }
        .coaching-body { color: #9ca3af; font-size: 15px; line-height: 1.9; font-weight: 400; font-family: 'Space Mono', monospace; white-space: pre-wrap; }

        .msa-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin: 32px 0 48px; }
        .msa-card { background: #1f2937; padding: clamp(16px,4vw,32px) clamp(8px,3vw,28px); text-align: center; }
        .msa-score-number { font-family: 'Bebas Neue', sans-serif; font-size: 80px; color: #f1f5f9; line-height: 1; }
        .msa-dots { display: flex; gap: 6px; margin: 12px 0 8px; justify-content: center; }
        .msa-dot-filled { width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; border: 1.5px solid #f59e0b; }
        .msa-dot-empty { width: 10px; height: 10px; border-radius: 50%; background: transparent; border: 1.5px solid #374151; }
        .msa-richting { font-family: 'Space Mono', monospace; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; display: block; margin-bottom: 0; }

        .ontwikkelpunt { display: flex; gap: 20px; align-items: flex-start; padding: 20px 0; border-bottom: 1px solid #374151; }
        .ontwikkelpunt:last-child { border-bottom: none; }
        .ontwikkelpunt-nr { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #f59e0b; line-height: 1; min-width: 32px; padding-top: 2px; }
        .ontwikkelpunt-text { font-size: 15px; line-height: 1.9; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        .pijlar-tag { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; display: block; margin-bottom: 4px; }

        .blog-item { display: block; color: #9ca3af; text-decoration: none; font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1.5px; line-height: 1; padding: 14px 20px; border-left: 3px solid #374151; margin-bottom: 2px; transition: all 0.15s; }
        .blog-item:hover { color: #f1f5f9; border-left-color: #f59e0b; background: #1f2937; }

        .generate-btn { background: #f59e0b; border: none; cursor: pointer; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; color: #111827; padding: 12px 36px; transition: background 0.2s; border-radius: 999px; min-width: 220px; }
        .generate-btn:hover:not(:disabled) { background: #d97706; }
        .generate-btn:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
        .pdf-btn { background: none; border: 1px solid #374151; cursor: pointer; font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; color: #9ca3af; padding: 11px 32px; transition: all 0.2s; border-radius: 999px; min-width: 220px; }
        .pdf-btn:hover { border-color: #6b7280; color: #f1f5f9; }

        .stat-block { text-align: center; }
        .stat-number { font-family: 'Bebas Neue', sans-serif; font-size: 56px; color: #f59e0b; line-height: 1; }
        .stat-label { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 4px; color: #9ca3af; margin-top: 4px; }

        .loading-dot { width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; display: inline-block; margin: 0 3px; }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }

        @media (max-width: 640px) {
          .msa-grid { grid-template-columns: repeat(3, 1fr); }
          .msa-score-number { font-size: clamp(36px, 10vw, 64px); }
        }
        .print-only { display: none; }
        @page { size: portrait; }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #ffffff !important; color: #111827 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          h1 { color: #111827 !important; }
          .msa-total { color: #111827 !important; }
          .msa-score-number { color: #111827 !important; }
          .msa-card { background: #f1f5f9 !important; }
          .msa-dot-empty { border-color: #9ca3af !important; }
          .coaching-label { color: #f59e0b !important; }
          .coaching-body { color: #374151 !important; }
          .pijlar-tag { color: #6b7280 !important; }
          .ontwikkelpunt-text { color: #111827 !important; }
          .coaching-section { border-top-color: #e5e7eb !important; page-break-inside: avoid; }
          .ontwikkelpunt { border-bottom-color: #e5e7eb !important; page-break-inside: avoid; }
          .msa-grid { page-break-inside: avoid; }
          .blog-item { color: #111827 !important; border-left-color: #f59e0b !important; background: transparent !important; text-decoration: underline !important; text-decoration-color: #f59e0b !important; }
          .blog-reden { color: #6b7280 !important; border-left-color: #e5e7eb !important; }
          .pg-grid > div { background: #f1f5f9 !important; }
          .mc-label { color: #374151 !important; }
          svg circle[fill="#1f2937"] { fill: #f1f5f9 !important; }
          a { text-decoration-color: #f59e0b; }
        }
      `}</style>

      <div className="no-print"><BotNav active="coaching" /></div>

      <div className="print-only" style={{ maxWidth: 812, margin: '0 auto', padding: '40px clamp(16px,4vw,20px) 0' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 6, lineHeight: 1, color: '#111827', marginBottom: 6 }}>
          ARNO<span style={{ color: '#f59e0b' }}>BOT</span>
        </p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 3, lineHeight: 1, color: '#111827', marginBottom: 12 }}>COACHING</h1>
        {firstName && (
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 3, color: '#f59e0b', marginBottom: 4 }}>{firstName.toUpperCase()}</p>
        )}
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: 1, color: '#6b7280', paddingBottom: 24, borderBottom: '2px solid #f59e0b' }}>
          {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {uitdaging && (
        <div className="no-print" style={{ background: '#111827', padding: 'clamp(96px,12vw,120px) clamp(20px,6vw,60px) 0' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, fontWeight: 400, color: '#f59e0b', display: 'block', marginBottom: 24 }}>THOUGHT OF THE DAY</span>
            <div style={{ background: '#1f2937', border: '1px solid #374151', padding: '28px 32px' }}>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, lineHeight: 2, color: '#9ca3af' }} dangerouslySetInnerHTML={{ __html: renderMd(uitdaging) }} />
            </div>
          </div>
          <div style={{ maxWidth: 680, margin: '0 auto', borderBottom: '2px solid #f59e0b', marginTop: 'clamp(48px,6vw,64px)' }} />
        </div>
      )}

      <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

        <div className="no-print">
          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', marginBottom: 32 }}>COACHING</h1>
        </div>


        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 16, paddingBottom: doc ? 48 : 0, borderBottom: doc ? '1px solid #374151' : 'none', gap: 24 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* /bot/sparren heeft geen ander toegangspunt in de app: zonder deze link zou de
                14-dagen-onderdrukking (showSparren) sparren voor iedereen die regelmatig spart
                onbereikbaar maken (gevonden 24 aug 2026). Altijd dezelfde knopvorm (herzien, zelfde
                dag): een losse, kleinere tekstversie voor de onderdrukte staat oogde ongebalanceerd
                naast COACH ME. Onderscheid blijft wel bestaan, alleen via tekstkleur (gedempter
                #6b7280 i.p.v. #9ca3af), niet via het compleet laten vallen van de knopvorm. */}
            <Link href="/bot/sparren" className="pdf-btn" title="Oefen een lastig gesprek met ArnoBot als tegenspeler" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: showSparren ? undefined : '#6b7280' }}>SPARREN →</Link>
            <button className="generate-btn" onClick={generate} disabled={generating || loading} title="Genereer je coachingsadvies op basis van mindset, systeem en actie">
              {generating ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span>ARNO GENEREERT</span>
                </span>
              ) : 'COACH ME →'}
            </button>
            {doc && (
              <button className="pdf-btn no-print" onClick={() => window.print()} title="Download dit coachingsadvies als PDF">DOWNLOAD PDF ↓</button>
            )}
            {isUpToDate && (
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#9ca3af', letterSpacing: 1 }}>✓ Advies is actueel</p>
            )}
          </div>
          {!doc && !loading && !blockReason && (
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: 1.9 }}>
              Arno analyseert je gesprekken op drie pijlers: Mindset, Systeem en Actie. Dit geeft je een indruk waar je staat en wat je het best aan zou kunnen pakken.
            </p>
          )}
          {blockReason === 'te_weinig' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: 10 }} />
              <p style={{ fontFamily: "'Space Mono', monospace", color: '#9ca3af', fontSize: 15, lineHeight: '29px', fontWeight: 400 }}>
                Je hebt {teWeinigCount} {teWeinigCount === 1 ? 'gesprek' : 'gesprekken'} gevoerd. Voor een coachingsadvies heb je er minimaal 5 nodig.
              </p>
            </div>
          )}
          {blockReason === 'te_weinig_voortgang' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: 10 }} />
              <p style={{ fontFamily: "'Space Mono', monospace", color: '#9ca3af', fontSize: 15, lineHeight: '29px', fontWeight: 400 }}>
                Je coaching is recent. Doe nog een paar gesprekken, dan heeft een nieuw advies meer diepte.
              </p>
            </div>
          )}
          {blockReason === 'stagnatie' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#cc2200', flexShrink: 0, marginTop: 10 }} />
              <p style={{ fontFamily: "'Space Mono', monospace", color: '#9ca3af', fontSize: 15, lineHeight: '29px', fontWeight: 400 }}>
                Dezelfde patronen komen meerdere rondes terug. De actiepunten hieronder geven je inzicht om mee te kunnen werken.
              </p>
            </div>
          )}
          {blockReason === 'hoge_scores' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#34d399', flexShrink: 0, marginTop: 10 }} />
              <p style={{ fontFamily: "'Space Mono', monospace", color: '#9ca3af', fontSize: 15, lineHeight: '29px', fontWeight: 400 }}>
                Je staat sterk op alle onderdelen. Voer meer gesprekken om jezelf tot de 1% elite te mogen rekenen.
              </p>
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#cc2200', flexShrink: 0, marginTop: 10 }} />
              <p style={{ fontFamily: "'Space Mono', monospace", color: '#9ca3af', fontSize: 15, lineHeight: '29px', fontWeight: 400 }}>
                {error} Lukt het niet? <a href="https://wa.me/31650695999?text=Hoi%20Arno%2C%20ik%20loop%20vast%20in%20ArnoBot." style={{ color: '#f59e0b' }} target="_blank" rel="noopener noreferrer">Stuur een WhatsApp</a>.
              </p>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#9ca3af' }}>LADEN</span>
          </div>
        )}

        {doc && (
          <div style={{ animation: 'fadein 0.5s ease' }}>

            {doc.stagnatie && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 32 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#cc2200', flexShrink: 0, marginTop: 10 }} />
                <p style={{ fontFamily: "'Space Mono', monospace", color: '#9ca3af', fontSize: 15, lineHeight: '29px', fontWeight: 400 }}>
                  Dezelfde patronen komen nu meerdere rondes terug. Overweeg een andere aanpak. Suggesties vind je hieronder.
                </p>
              </div>
            )}
            {!doc.stagnatie && doc.weinig_voortgang && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 32 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: 10 }} />
                <p style={{ fontFamily: "'Space Mono', monospace", color: '#9ca3af', fontSize: 15, lineHeight: '29px', fontWeight: 400 }}>
                  {progressSignal === true
                    ? 'Arno ziet in je recente gesprekken aanleiding voor een bijgewerkt advies.'
                    : 'De vorige actiepunten zijn nog niet volledig doorgevoerd in je aanpak. You can do it, tiger!'}
                </p>
              </div>
            )}

            {/* MSA Dashboard */}
            {hasMSA && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', display: 'block', marginBottom: 8 }}>MSA SCORE</span>
                  <span className="msa-total" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 96, color: '#f1f5f9', lineHeight: 1 }}>{msaScore}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', display: 'block', marginTop: 4 }}>/ 100</span>
                </div>
                <div className="msa-grid">
                  {msaPijlars.map(({ key, label, score, richting }) => {
                    const rc = RICHTING_CONFIG[richting] ?? RICHTING_CONFIG.stabiel
                    return (
                      <div key={key} className="msa-card">
                        <span className="coaching-label">{label}</span>
                        <div className="msa-score-number">{score}</div>
                        <div className="msa-dots">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={i <= score ? 'msa-dot-filled' : 'msa-dot-empty'} />
                          ))}
                        </div>
                        <span className="msa-richting" style={{ color: rc.color }}>{rc.arrow} {richting?.toUpperCase() ?? ''}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Mindset */}
            {hasMSA && doc.mindset_diagnose && (
              <div className="coaching-section" style={{ borderTop: 'none', paddingTop: 0 }}>
                <span className="coaching-label" style={{ color: '#f1f5f9' }}>MINDSET</span>
                <p className="coaching-body" dangerouslySetInnerHTML={{ __html: renderMd(doc.mindset_diagnose) }} />
              </div>
            )}

            {/* Systeem */}
            {hasMSA && doc.systeem_diagnose && (
              <div className="coaching-section">
                <span className="coaching-label" style={{ color: '#f1f5f9' }}>SYSTEEM</span>
                <p className="coaching-body" dangerouslySetInnerHTML={{ __html: renderMd(doc.systeem_diagnose) }} />
              </div>
            )}

            {/* Actie */}
            {hasMSA && doc.actie_diagnose && (
              <div className="coaching-section">
                <span className="coaching-label" style={{ color: '#f1f5f9' }}>ACTIE</span>
                <p className="coaching-body" dangerouslySetInnerHTML={{ __html: renderMd(doc.actie_diagnose) }} />
              </div>
            )}

            {/* Ontwikkelpunten */}
            <div className="coaching-section">
              <span className="coaching-label">JOUW ONTWIKKELPUNTEN</span>
              <div style={{ marginTop: 8 }}>
                {(doc.ontwikkelpunten ?? []).map((p, i) => (
                  <div key={i} className="ontwikkelpunt">
                    <span className="ontwikkelpunt-nr">{i + 1}</span>
                    <div>
                      <span className="pijlar-tag" style={{ color: PIJLAR_COLOR }}>
                        [{p.pijlar?.toUpperCase() ?? ''}]
                      </span>
                      <span className="ontwikkelpunt-text" dangerouslySetInnerHTML={{ __html: renderMd(p.tekst) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Signalen */}
            {(doc.signalen?.length ?? 0) > 0 && (
              <div className="coaching-section">
                <span className="coaching-label">SIGNALEN</span>
                <div style={{ marginTop: 8 }}>
                  {doc.signalen!.map((s, i) => (
                    <p
                      key={i}
                      className="coaching-body"
                      style={{ marginBottom: i < doc.signalen!.length - 1 ? 8 : 0 }}
                      dangerouslySetInnerHTML={{ __html: renderMd(s) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Scoregeschiedenis */}
            {SCORE_HISTORY_ENABLED && scoreHistory.length > 0 && (
              <div className="coaching-section">
                <span className="coaching-label">PROGRESSIE</span>
                <div style={{ marginTop: 16 }}>
                  <ProgressieChart history={scoreHistory} />
                </div>
              </div>
            )}

            {/* Eerdere rapportages */}
            {history.length > 0 && (
              <div className="coaching-section">
                <span className="coaching-label">ARCHIEF</span>
                <div style={{ marginTop: 8 }}>
                  {history.map(h => (
                    <div key={h.id} style={{ borderTop: '1px solid #374151' }}>
                      <button
                        onClick={() => setExpandedHistoryId(expandedHistoryId === h.id ? null : h.id)}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '20px 0', fontFamily: "'Space Mono', monospace" }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                          <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', width: 165, flexShrink: 0 }}>
                            {formatHistoryDate(h.created_at)}
                          </span>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <p style={{ color: '#f1f5f9', fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4, margin: 0 }}>
                              {getReportTitle(h)}
                            </p>
                          </div>
                          <span style={{ color: expandedHistoryId === h.id ? '#f59e0b' : '#9ca3af', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, flexShrink: 0 }}>
                            {expandedHistoryId === h.id ? '↑ SLUITEN' : '↓ OPEN'}
                          </span>
                        </div>
                      </button>
                      {expandedHistoryId === h.id && (
                        <div style={{ paddingBottom: 32 }}>
                          {h.mindset_diagnose && (
                            <div style={{ marginBottom: 20 }}>
                              <span className="coaching-label" style={{ color: '#f1f5f9', marginBottom: 6 }}>MINDSET</span>
                              <p className="coaching-body">{h.mindset_diagnose}</p>
                            </div>
                          )}
                          {h.systeem_diagnose && (
                            <div style={{ marginBottom: 20 }}>
                              <span className="coaching-label" style={{ color: '#f1f5f9', marginBottom: 6 }}>SYSTEEM</span>
                              <p className="coaching-body">{h.systeem_diagnose}</p>
                            </div>
                          )}
                          {h.actie_diagnose && (
                            <div>
                              <span className="coaching-label" style={{ color: '#f1f5f9', marginBottom: 6 }}>ACTIE</span>
                              <p className="coaching-body">{h.actie_diagnose}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verdieping */}
            {(doc.blogs?.length ?? 0) > 0 && (
              <div className="coaching-section">
                <span className="coaching-label">ARNO.BLOGS</span>
                <div style={{ marginTop: 8 }}>
                  {doc.blogs.map((b, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <a href={b.url} target="_blank" rel="noopener noreferrer" className="blog-item">{b.title}</a>
                      {b.reden && (
                        <p className="blog-reden" style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, color: '#6b7280', lineHeight: 1.8, padding: '10px 20px 4px', borderLeft: '3px solid #1f2937' }}
                          dangerouslySetInnerHTML={{ __html: renderMd(b.reden) }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {doc && plan === 'premium' && paid && !isTeamMember && !gesprekBookedAt && (
          <div className="no-print" style={{ borderTop: '1px solid #374151', paddingTop: 40, marginTop: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>
              Wil je dit doorspreken met Arno zelf?<br />
              Elke gebruiker krijgt één gratis gesprek.
            </p>
            <a
              href="/bot/gesprek"
              onClick={() => {
                fetch('/api/bot/events', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ eventName: 'coaching_gesprek_click' }),
                }).catch(() => {})
              }}
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '12px 36px', background: '#f59e0b', color: '#111827', textDecoration: 'none', borderRadius: 999, whiteSpace: 'nowrap', minWidth: 220, textAlign: 'center' }}
            >
              PLAN GESPREK →
            </a>
          </div>
        )}

        <div className="no-print" style={{ borderTop: '1px solid #374151', paddingTop: 40, marginTop: doc ? 48 : 0 }}>
          <Link href="/bot" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#f59e0b', textDecoration: 'none' }}>
            ← TERUG NAAR DE BOT
          </Link>
        </div>

      </div>
    </>
  )
}
