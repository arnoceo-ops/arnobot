'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import BotNav from '../BotNav'
import { useIsMobile } from '@/hooks/useBreakpoint'
import { useProgressHints } from '@/hooks/useProgressHints'

interface Session {
  id: string
  session_id: string
  title: string
  summary: string
  message_count: number
  created_at: string
  blog_suggestions?: { title: string; url: string }[]
}

interface ConvMessage {
  role: 'user' | 'arno'
  content: string
}

interface SavedAnalyse {
  id: string
  created_at: string
  analyse_text: string
  session_count: number
}

function renderContent(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

function renderAnalyseText(text: string): string {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const items = safe.split('\n').map(line => {
    const t = line.trim()
    if (!t || /^-{2,}$/.test(t)) return ''
    const fullBold = t.match(/^\*\*([^*]+)\*\*$/)
    if (fullBold) return `<span class="ah">${fullBold[1]}</span>`
    if (t.length < 60 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/\*/.test(t)) {
      return `<span class="ah">${t}</span>`
    }
    return t.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f1f5f9;font-weight:700">$1</strong>')
  }).filter(s => s.length > 0)

  return items.map((item, i) => {
    const isHeading = item.startsWith('<span class="ah">')
    const nextIsHeading = items[i + 1]?.startsWith('<span class="ah">') ?? true
    if (isHeading || nextIsHeading) return item
    return item + '<br>'
  }).join('')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Sort = 'newest' | 'oldest' | 'most' | 'least'

export default function GeschiedenisPage() {
  const isMobile = useIsMobile()
  const { showCoachingHint, activeCoachingHint, analysesSinceLastCoaching, daysSinceLastCoaching, convsSinceLastCoaching, dismissCoachingHint } = useProgressHints()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('newest')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [convMessages, setConvMessages] = useState<ConvMessage[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [analyseLoading, setAnalyseLoading] = useState(false)
  const [activeAnalyse, setActiveAnalyse] = useState<string | null>(null)
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalyse[]>([])
  const [expandedAnalyse, setExpandedAnalyse] = useState<string | null>(null)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [showAllAnalyses, setShowAllAnalyses] = useState(false)
  const [semanticSessions, setSemanticSessions] = useState<Session[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [isDuplicateAnalyse, setIsDuplicateAnalyse] = useState(false)
  const [isSimilarAnalyse, setIsSimilarAnalyse] = useState(false)
  const [isDeltaAnalyse, setIsDeltaAnalyse] = useState(false)
  const [analyseLimiet, setAnalyseLimiet] = useState(false)
  const [shareLoading, setShareLoading] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [isTeamMember, setIsTeamMember] = useState(false)
  const [sharedAnalyseIds, setSharedAnalyseIds] = useState<Set<string>>(new Set())
  const [teamShareLoadingId, setTeamShareLoadingId] = useState<string | null>(null)
  const analysesSectionRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/bot/sessions')
      .then(r => r.json())
      .then(data => setSessions(data.sessions ?? []))
      .finally(() => setLoading(false))
    fetch('/api/bot/coaching-analyses')
      .then(r => r.json())
      .then(data => setSavedAnalyses(data.analyses ?? []))
      .catch(() => {})
    if (new URLSearchParams(window.location.search).get('previewMember') === '1') {
      setIsTeamMember(true)
    } else {
      fetch('/api/bot/team/status')
        .then(r => r.json())
        .then(d => { if (d.hasTeam && !d.isManager) setIsTeamMember(true) })
        .catch(() => {})
    }
    fetch('/api/bot/team/share-analyse')
      .then(r => r.json())
      .then(d => setSharedAnalyseIds(new Set(d.sharedIds ?? [])))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!search || search.length < 2) {
      setSemanticSessions(null)
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bot/sessions/search?q=${encodeURIComponent(search)}`)
        const data = await res.json()
        setSemanticSessions(data.sessions ?? [])
      } catch {
        setSemanticSessions([])
      }
      setSearchLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const filtered = sessions.filter(s =>
    !search ||
    s.title?.toLowerCase().includes(search.toLowerCase()) ||
    s.summary?.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sort === 'most') return b.message_count - a.message_count
    if (sort === 'least') return a.message_count - b.message_count
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const ANALYSE_MAX = 20

  function toggleSelect(sessionId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else if (next.size < ANALYSE_MAX) {
        next.add(sessionId)
      }
      return next
    })
  }

  async function deleteSelected() {
    if (selected.size === 0 || deleting) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map(id =>
        fetch(`/api/bot/session?sessionId=${id}`, { method: 'DELETE' })
      ))
      setSessions(prev => prev.filter(s => !selected.has(s.session_id)))
      if (expanded && selected.has(expanded)) {
        setExpanded(null)
        expandedRef.current = null
        setConvMessages([])
      }
      setSelected(new Set())
    } catch {
      alert('Verwijderen mislukt. Probeer opnieuw.')
    } finally {
      setDeleting(false)
    }
  }

  function getAnalyseTitle(text: string): string {
    const clean = text.replace(/\n/g, ' ').trim()
    if (clean.length <= 80) return clean
    const cut = clean.slice(0, 77)
    const lastSpace = cut.lastIndexOf(' ')
    return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '...'
  }

  async function toggleSession(sessionId: string) {
    if (expanded === sessionId) {
      setExpanded(null)
      expandedRef.current = null
      setConvMessages([])
      return
    }
    setExpandedAnalyse(null)
    setExpanded(sessionId)
    expandedRef.current = sessionId
    setConvLoading(true)
    setConvMessages([])
    try {
      const res = await fetch(`/api/bot/session?sessionId=${sessionId}`)
      const data = await res.json()
      if (expandedRef.current === sessionId) {
        setConvMessages(data.messages ?? [])
        setConvLoading(false)
      }
    } catch {
      if (expandedRef.current === sessionId) setConvLoading(false)
    }
  }

  async function handleShareSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setShareLoading(sessionId)
    try {
      const res = await fetch('/api/bot/share-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (data.url) {
        setShareUrl(data.url)
        try { await navigator.clipboard.writeText(data.url) } catch {
          try {
            const ta = document.createElement('textarea')
            ta.value = data.url
            ta.style.position = 'fixed'
            ta.style.opacity = '0'
            document.body.appendChild(ta)
            ta.focus()
            ta.select()
            document.execCommand('copy')
            document.body.removeChild(ta)
          } catch {}
        }
      }
    } finally {
      setShareLoading(null)
    }
  }

  async function toggleTeamShare(analyseId: string) {
    setTeamShareLoadingId(analyseId)
    const isShared = sharedAnalyseIds.has(analyseId)
    try {
      if (isShared) {
        await fetch(`/api/bot/team/share-analyse?analyseId=${analyseId}`, { method: 'DELETE' })
        setSharedAnalyseIds(prev => { const next = new Set(prev); next.delete(analyseId); return next })
      } else {
        await fetch('/api/bot/team/share-analyse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analyseId }),
        })
        setSharedAnalyseIds(prev => new Set([...prev, analyseId]))
      }
    } catch {}
    setTeamShareLoadingId(null)
  }

  async function runAnalyse(sessionIds?: string[]) {
    setAnalyseLoading(true)
    setActiveAnalyse(null)
    setIsDuplicateAnalyse(false)
    setIsSimilarAnalyse(false)
    setIsDeltaAnalyse(false)
    setAnalyseLimiet(false)
    try {
      const body = sessionIds ? { sessionIds } : {}
      const res = await fetch('/api/bot/coaching-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 429) {
        setAnalyseLimiet(true)
        setAnalyseLoading(false)
        setSelected(new Set())
        return
      }
      const data = await res.json()
      if (data.duplicate) {
        setIsDuplicateAnalyse(true)
        setActiveAnalyse(data.analyse)
      } else if (data.analyse) {
        if (data.delta) setIsDeltaAnalyse(true)
        setActiveAnalyse(data.analyse)
        if (data.id) {
          setSavedAnalyses(prev => [{
            id: data.id,
            created_at: data.created_at,
            analyse_text: data.analyse,
            session_count: data.count,
          }, ...prev])
        }
      }
    } catch {}
    setAnalyseLoading(false)
    setSelected(new Set())
    setTimeout(() => analysesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }

  const hasSelected = selected.size > 0
  const isSemanticMode = semanticSessions !== null && semanticSessions.length > 0
  const visibleSessions = isSemanticMode
    ? semanticSessions
    : (search ? sorted : sorted.slice(0, showAllSessions ? sorted.length : 5))
  const hasMore = !isSemanticMode && !search && !showAllSessions && sorted.length > 5

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }
        @keyframes fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideup { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 0%,100%{opacity:0.2} 50%{opacity:1} }
        .loading-dot { display:inline-block;width:7px;height:7px;border-radius:50%;background:#f59e0b;animation:blink 1.2s ease-in-out infinite; }
        .loading-dot:nth-child(2){animation-delay:0.2s}
        .loading-dot:nth-child(3){animation-delay:0.4s}
        .analyse-loading-bar { position:fixed;bottom:0;left:0;right:0;z-index:200;background:#111827;border-top:2px solid #f59e0b;padding:20px 40px;display:flex;align-items:center;justify-content:center;gap:12px;animation:slideup 0.2s ease; }

        .sort-btn {
          background: #1f2937; border: none; box-shadow: inset 0 0 0 1px #f59e0b; color: #9ca3af;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 15px; letter-spacing: 3px;
          padding: 9px 20px; cursor: pointer; transition: all 0.15s;
          border-radius: 999px;
        }
        .sort-btn:hover { color: #f1f5f9; }
        .sort-btn.active { background: #f59e0b; box-shadow: none; color: #111827; }

        .delete-bar {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
          background: #111827; border-top: 2px solid #f59e0b;
          padding: 20px 40px;
          display: flex; align-items: center; justify-content: center; gap: 24px;
          animation: slideup 0.2s ease; flex-wrap: wrap;
        }
        .delete-bar-count {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px; letter-spacing: 3px; color: #f59e0b;
        }
        .delete-bar-actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: center; }
        .delete-bar-cancel {
          background: none; border: none; box-shadow: inset 0 0 0 1px #f59e0b; cursor: pointer;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px; letter-spacing: 3px; color: #f1f5f9;
          transition: all 0.15s; padding: 11px 0;
          width: 180px; text-align: center; border-radius: 999px;
        }
        .delete-bar-cancel:hover { color: #f59e0b; }
        .delete-bar-btn {
          background: #f59e0b; border: none; cursor: pointer;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px; letter-spacing: 3px; color: #111827;
          padding: 11px 0; transition: background 0.15s;
          width: 180px; text-align: center; border-radius: 999px;
        }
        .delete-bar-btn:hover { background: #d97706; }
        .delete-bar-btn:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
        .delete-bar-outline {
          background: #f59e0b; border: none; box-shadow: none; cursor: pointer;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px; letter-spacing: 3px; color: #111827;
          padding: 11px 0; transition: background 0.15s;
          width: 180px; text-align: center; border-radius: 999px;
        }
        .delete-bar-outline:hover { background: #d97706; }
        .delete-bar-outline:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
        .delete-bar-destructive {
          background: none; border: none; box-shadow: inset 0 0 0 1px #cc2200; cursor: pointer;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px; letter-spacing: 3px; color: #cc2200;
          padding: 11px 0; transition: all 0.15s;
          width: 180px; text-align: center; border-radius: 999px;
        }
        .delete-bar-destructive:hover { box-shadow: inset 0 0 0 1px #ff3300; color: #ff3300; }
        .delete-bar-destructive:disabled { box-shadow: inset 0 0 0 1px #374151; color: #4b5563; cursor: not-allowed; }

        .session-checkbox {
          flex-shrink: 0; width: 22px; height: 22px;
          border: 2px solid #374151; background: none;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-family: 'Bebas Neue', sans-serif; font-size: 14px;
          transition: all 0.12s; color: transparent;
        }
        .session-checkbox:hover { border-color: #6b7280; }
        .session-checkbox.checked { border-color: #f59e0b; background: #f59e0b; color: #111827; }

        .analyse-item {
          border-top: 1px solid #374151; padding: 20px 0;
          animation: fadein 0.3s ease;
        }
        .analyse-item-header {
          display: flex; align-items: center; justify-content: space-between;
          cursor: pointer; gap: 16px;
        }
        .analyse-item-meta {
          font-family: 'Bebas Neue', sans-serif; font-size: 14px;
          letter-spacing: 2px; color: #9ca3af;
        }
        .analyse-item-full {
          color: #9ca3af; font-size: 15px; line-height: 1.9;
          font-family: 'Space Mono', monospace;
          background: #1f2937; border-left: 3px solid #f59e0b;
          padding: 20px 24px; margin-bottom: 8px;
        }
        .ah { font-family:'Space Mono',monospace; font-weight:400; font-size:13px; letter-spacing:4px; color:#f1f5f9; display:block; margin:24px 0 8px; }
        .ah:first-child { margin-top:0; }

        @media (max-width: 768px) {
          .delete-bar { padding: 16px 20px; gap: 12px; }
          .delete-bar-cancel, .delete-bar-btn, .delete-bar-outline, .delete-bar-destructive { width: 140px; font-size: 14px; padding: 10px 0; }
        }
      `}</style>

      <BotNav active="archief" />

      <div style={{ maxWidth: 812, margin: '0 auto', padding: `clamp(80px,12vw,120px) clamp(16px,4vw,20px) ${hasSelected ? 100 : 80}px` }}>

        <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT</p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', marginBottom: 32 }}>GESPREKKEN</h1>

        {!loading && sessions.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, marginBottom: 48 }}>
            {[
              { label: 'GESPREKKEN', value: sessions.length },
              { label: 'VRAGEN', value: sessions.reduce((sum, s) => sum + (s.message_count || 0), 0) },
              { label: 'ANALYSES', value: savedAnalyses.length },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#1f2937', padding: 'clamp(16px,3vw,28px) clamp(8px,2vw,20px)', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 'clamp(9px,2vw,13px)', letterSpacing: 'clamp(1px,0.5vw,4px)', color: '#f59e0b', marginBottom: 8 }}>{label}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px,9vw,64px)', color: '#f1f5f9', lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Zoekbalk */}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoek in gesprekken..."
            style={{
              width: '100%', background: '#1f2937', border: '1px solid #374151',
              borderRadius: 4, color: '#f1f5f9', fontFamily: "'Space Mono', monospace",
              fontSize: 15, padding: '12px 16px', paddingRight: 44, outline: 'none', letterSpacing: 1,
            }}
            onFocus={e => (e.target.style.borderColor = '#f59e0b')}
            onBlur={e => (e.target.style.borderColor = '#374151')}
          />
          {searchLoading && (
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 3 }}>
              <span className="loading-dot" style={{ width: 5, height: 5 }} />
              <span className="loading-dot" style={{ width: 5, height: 5, animationDelay: '0.2s' }} />
              <span className="loading-dot" style={{ width: 5, height: 5, animationDelay: '0.4s' }} />
            </span>
          )}
        </div>

        {/* Knoppen balk */}
        {!loading && visibleSessions.length > 0 && (
          <div style={{ marginBottom: 32, padding: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className={`sort-btn${selected.size > 0 ? ' active' : ''}`}
                style={{ borderRadius: 8 }}
                onClick={() => {
                  if (selected.size > 0) setSelected(new Set())
                  else {
                    const pool = isSemanticMode && semanticSessions ? semanticSessions : sorted
                    setSelected(new Set(pool.slice(0, ANALYSE_MAX).map(s => s.session_id)))
                  }
                }}
              >
                {selected.size > 0 ? 'DESELECTEER ALLES' : 'SELECTEER ALLES'}
              </button>
              {showAllSessions && !search && sorted.length > 5 && (
                <button
                  className="sort-btn"
                  style={{ borderRadius: 8 }}
                  onClick={() => setShowAllSessions(false)}
                >
                  TOON MINDER ↑
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className={`sort-btn${sort === 'newest' || sort === 'oldest' ? ' active' : ''}`}
                style={{ borderRadius: 8, minWidth: 110 }}
                onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')}
              >
                DATUM {sort === 'oldest' ? '↑' : '↓'}
              </button>
              <button
                className={`sort-btn${sort === 'most' || sort === 'least' ? ' active' : ''}`}
                style={{ borderRadius: 8, minWidth: 110 }}
                onClick={() => setSort(sort === 'most' ? 'least' : 'most')}
              >
                VRAGEN {sort === 'least' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 400, color: '#9ca3af', border: '1px solid #374151', borderLeft: '3px solid #f59e0b', padding: '10px 16px', display: 'inline-block', marginBottom: 24 }}>
            Selecteer minimaal 3 gesprekken voor een analyse.
          </p>
        )}

        {loading && (
          <p style={{ color: '#9ca3af', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' }}>Laden...</p>
        )}

        {!loading && !searchLoading && visibleSessions.length === 0 && (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <p style={{ color: '#374151', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>
              {search ? 'Geen gesprekken gevonden' : 'Nog geen gesprekken'}
            </p>
            {!search && (
              <Link href="/bot" style={{ color: '#f59e0b', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, textDecoration: 'none' }}>
                START EERSTE GESPREK →
              </Link>
            )}
          </div>
        )}

        {/* Sessie-lijst */}
        {visibleSessions.map(session => {
          const isSelected = selected.has(session.session_id)
          const isOpen = expanded === session.session_id
          return (
            <div key={session.session_id} id={`session-${session.session_id}`} style={{ borderTop: '1px solid #374151', animation: 'fadein 0.3s ease', padding: isOpen ? '0 20px' : undefined }}>

              {isMobile ? (
                /* Mobile card layout */
                <div style={{ padding: '20px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <button
                      className={`session-checkbox${isSelected ? ' checked' : ''}`}
                      onClick={() => toggleSelect(session.session_id)}
                      title={isSelected ? 'Deselecteer' : 'Selecteer'}
                    >
                      {isSelected ? '✓' : ''}
                    </button>
                    <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Space Mono', monospace", flex: 1 }}>
                      {formatDateShort(session.created_at)}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Space Mono', monospace", whiteSpace: 'nowrap' }}>
                      {session.message_count} {session.message_count === 1 ? 'vraag' : 'vragen'}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleSession(session.session_id)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                  >
                    <p style={{ color: '#f1f5f9', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4, marginBottom: session.summary ? 6 : 0 }}>
                      {session.title}
                    </p>
                    {session.summary && (
                      <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {session.summary}
                      </p>
                    )}
                    <span style={{ color: isOpen ? '#f59e0b' : '#6b7280', fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, display: 'block', marginTop: 8 }}>
                      {isOpen ? '↑ SLUITEN' : '↓ OPEN'}
                    </span>
                  </button>
                </div>
              ) : (
                /* Desktop card layout */
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '28px 0' }}>
                  <button
                    className={`session-checkbox${isSelected ? ' checked' : ''}`}
                    onClick={() => toggleSelect(session.session_id)}
                    title={isSelected ? 'Deselecteer' : 'Selecteer'}
                  >
                    {isSelected ? '✓' : ''}
                  </button>
                  <button
                    onClick={() => toggleSession(session.session_id)}
                    style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 24, textAlign: 'left', padding: 0 }}
                  >
                    <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 120, fontFamily: "'Space Mono', monospace" }}>
                      {formatDate(session.created_at)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#f1f5f9', fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4, marginBottom: session.summary ? 6 : 0 }}>
                        {session.title}
                      </p>
                      {session.summary && (
                        <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {session.summary}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: "'Space Mono', monospace" }}>
                        {session.message_count} {session.message_count === 1 ? 'vraag' : 'vragen'}
                      </span>
                      <span style={{ color: isOpen ? '#f59e0b' : '#9ca3af', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>
                        {isOpen ? '↑ SLUITEN' : '↓ OPEN'}
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {isOpen && (
                <div
                  onClick={() => {
                    toggleSession(session.session_id)
                    setTimeout(() => {
                      document.getElementById(`session-${session.session_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 50)
                  }}
                  style={{ paddingBottom: 40, animation: 'fadein 0.3s ease', cursor: 'pointer' }}
                  title="Klik om te sluiten"
                >
                  {session.summary && (
                    <div style={{ background: '#1f2937', borderLeft: '3px solid #f59e0b', padding: '20px 24px', marginBottom: 32 }}>
                      <p style={{ color: '#f59e0b', fontSize: 13, fontWeight: 400, fontFamily: "'Space Mono', monospace", letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12 }}>SYNTHESE</p>
                      <p style={{ color: '#9ca3af', fontSize: 15, fontFamily: "'Space Mono', monospace", lineHeight: 1.9, marginBottom: session.blog_suggestions?.length ? 24 : 0 }} dangerouslySetInnerHTML={{ __html: renderContent(session.summary) }} />
                      {session.blog_suggestions && session.blog_suggestions.length > 0 && (
                        <div style={{ borderTop: '1px solid #374151', paddingTop: 20 }}>
                          <p style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12, fontFamily: "'Bebas Neue', sans-serif" }}>VERDER LEZEN</p>
                          {session.blog_suggestions.map((b, i) => (
                            <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{
                              display: 'block', color: '#9ca3af', textDecoration: 'none',
                              fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1.5,
                              lineHeight: 1, padding: '10px 16px', marginBottom: 2,
                              borderLeft: '3px solid #374151', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#f1f5f9'; (e.currentTarget as HTMLAnchorElement).style.borderLeftColor = '#f59e0b'; (e.currentTarget as HTMLAnchorElement).style.background = '#1f2937' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#9ca3af'; (e.currentTarget as HTMLAnchorElement).style.borderLeftColor = '#374151'; (e.currentTarget as HTMLAnchorElement).style.background = 'none' }}
                            >
                              {b.title}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }} onClick={e => e.stopPropagation()}>
                    <Link
                      href={`/bot?resume=${session.session_id}`}
                      onClick={e => e.stopPropagation()}
                      style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#9ca3af', textDecoration: 'none' }}
                      onMouseOver={e => (e.currentTarget.style.color = '#f1f5f9')}
                      onMouseOut={e => (e.currentTarget.style.color = '#9ca3af')}
                    >
                      <span style={{ color: '#f59e0b' }}>←</span> VERVOLG DIT GESPREK IN ARNOBOT
                    </Link>
                    <button
                      onClick={e => handleShareSession(session.session_id, e)}
                      disabled={shareLoading === session.session_id}
                      style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onMouseOver={e => (e.currentTarget.style.color = '#f1f5f9')}
                      onMouseOut={e => (e.currentTarget.style.color = '#9ca3af')}
                    >
                      {shareLoading === session.session_id ? '...' : <>DEEL DIT GESPREK <span style={{ color: '#f59e0b' }}>→</span></>}
                    </button>
                  </div>

                  {convLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0' }}>
                      <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 4, color: '#6b7280' }}>GESPREK LADEN</span>
                    </div>
                  )}
                  {convMessages.map((msg, i) => (
                    <div key={i} style={{
                      padding: '20px 24px',
                      borderTop: '1px solid #374151',
                      display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                      gap: isMobile ? 4 : 32, alignItems: 'flex-start',
                      background: msg.role === 'user' ? undefined : '#1f2937',
                    }}>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: msg.role === 'user' ? '#6b7280' : '#f59e0b', whiteSpace: 'nowrap', paddingTop: isMobile ? 0 : 2, minWidth: isMobile ? 0 : 48 }}>
                        {msg.role === 'user' ? 'JIJ' : 'ARNO'}
                      </span>
                      <span
                        style={msg.role === 'user'
                          ? { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(18px,3vw,26px)', lineHeight: 1.5, color: '#f1f5f9', letterSpacing: '0.5px', whiteSpace: 'pre-wrap' }
                          : { fontFamily: "'Space Mono', monospace", fontSize: 15, lineHeight: 1.9, color: '#9ca3af', fontWeight: 400, letterSpacing: 0, whiteSpace: 'pre-wrap', maxWidth: 680 }}
                        dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                      />
                    </div>
                  ))}

                  <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { toggleSession(session.session_id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onMouseOver={e => (e.currentTarget.style.color = '#f1f5f9')}
                      onMouseOut={e => (e.currentTarget.style.color = '#9ca3af')}
                    >
                      SLUITEN ↑
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Toon meer / minder sessies */}
        {!search && sorted.length > 5 && (
          <div style={{ borderTop: '1px solid #374151', padding: '28px 0', textAlign: 'center' }}>
            <button
              onClick={() => setShowAllSessions(v => !v)}
              style={{ background: 'none', border: '1px solid #374151', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3, color: '#9ca3af', padding: '11px 32px', borderRadius: 999, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#374151'; (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af' }}
            >
              {showAllSessions ? `TOON MINDER ↑` : `TOON ALLE ${sorted.length} GESPREKKEN ↓`}
            </button>
          </div>
        )}

        {/* Analyses sectie */}
        {analyseLimiet && (
          <div ref={analysesSectionRef} style={{ borderTop: '1px solid #374151', paddingTop: 32, marginTop: 16 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#f59e0b', lineHeight: 1.9, border: '1px solid #f59e0b', borderLeft: '3px solid #f59e0b', padding: '16px 20px' }}>
              Je hebt vandaag al een analyse gemaakt. Basis-gebruikers kunnen 1 analyse per dag aanmaken. Kom morgen terug of upgrade naar Pro voor onbeperkte analyses.
            </p>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div ref={analysesSectionRef} style={{ borderTop: '1px solid #374151', paddingTop: 40, marginTop: 16 }}>
            <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, marginBottom: showCoachingHint && savedAnalyses.length > 0 && !activeAnalyse ? 24 : 48 }}>ANALYSES</h2>

            {showCoachingHint && savedAnalyses.length > 0 && !activeAnalyse && (
              <div style={{ background: '#1f2937', border: '1px solid #374151', padding: '14px 20px', marginBottom: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280' }}>
                  {activeCoachingHint === 'B'
                    ? `${daysSinceLastCoaching} dagen geen coaching · ${convsSinceLastCoaching} nieuwe ${convsSinceLastCoaching === 1 ? 'gesprek' : 'gesprekken'}`
                    : `${analysesSinceLastCoaching} nieuwe ${analysesSinceLastCoaching === 1 ? 'analyse' : 'analyses'} zonder coaching`
                  }
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <Link
                    href="/bot/coaching"
                    style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3, color: '#f59e0b', textDecoration: 'none' }}
                  >
                    NAAR COACHING →
                  </Link>
                  <button
                    onClick={dismissCoachingHint}
                    style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    aria-label="Sluiten"
                  >×</button>
                </div>
              </div>
            )}

            {!activeAnalyse && savedAnalyses.length === 0 && !analyseLimiet && (
              <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 15, color: '#9ca3af', lineHeight: 1.9, border: '1px solid #374151', borderLeft: '3px solid #374151', padding: '16px 20px', marginBottom: 32 }}>
                Selecteer 3 of meer gesprekken hierboven voor je eerste analyse.
              </p>
            )}

            {activeAnalyse && !isDuplicateAnalyse && (
              <div style={{ marginBottom: 28, background: '#1f2937', borderLeft: `3px solid ${isDeltaAnalyse ? '#f59e0b' : '#f59e0b'}`, padding: '20px 24px' }}>
                <p style={{ color: '#f59e0b', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12 }}>
                  {isDeltaAnalyse ? 'WAT ER VERANDERD IS' : 'NIEUW GEGENEREERD'}
                </p>
                <div style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.9, fontFamily: "'Space Mono', monospace", marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: renderAnalyseText(activeAnalyse) }} />
                <button
                  onClick={() => setActiveAnalyse(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 3, color: '#9ca3af', padding: 0 }}
                >
                  × VERBERG
                </button>
              </div>
            )}
            {isDuplicateAnalyse && (
              <p style={{ color: '#6b7280', fontSize: 12, letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 28 }}>
                Deze combinatie is al eerder geanalyseerd. Zie hieronder.
              </p>
            )}

            {savedAnalyses.slice(activeAnalyse && !isDuplicateAnalyse ? 1 : 0, showAllAnalyses ? undefined : (activeAnalyse && !isDuplicateAnalyse ? 4 : 5)).map(a => (
              <div key={a.id} style={{ borderTop: '1px solid #374151', animation: 'fadein 0.3s ease' }}>
                <button
                  onClick={() => {
                    if (expandedAnalyse === a.id) { setExpandedAnalyse(null); return }
                    setExpanded(null); expandedRef.current = null; setConvMessages([])
                    setExpandedAnalyse(a.id)
                  }}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '20px 0' }}
                >
                  {isMobile ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Space Mono', monospace" }}>
                          {formatDateShort(a.created_at)}
                        </span>
                        <span style={{ color: '#6b7280', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Space Mono', monospace" }}>
                          {a.session_count} {a.session_count === 1 ? 'GESPREK' : 'GESPREKKEN'}
                        </span>
                      </div>
                      <p style={{ color: '#f1f5f9', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4, marginBottom: 8 }}>
                        {getAnalyseTitle(a.analyse_text)}
                      </p>
                      <span style={{ color: expandedAnalyse === a.id ? '#f59e0b' : '#6b7280', fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>
                        {expandedAnalyse === a.id ? '↑ SLUITEN' : '↓ OPEN'}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 120, fontFamily: "'Space Mono', monospace" }}>
                        {formatDate(a.created_at)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: '#f1f5f9', fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4 }}>
                          {getAnalyseTitle(a.analyse_text)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: "'Space Mono', monospace" }}>
                          {a.session_count} {a.session_count === 1 ? 'GESPREK' : 'GESPREKKEN'}
                        </span>
                        <span style={{ color: expandedAnalyse === a.id ? '#f59e0b' : '#9ca3af', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>
                          {expandedAnalyse === a.id ? '↑ SLUITEN' : '↓ OPEN'}
                        </span>
                      </div>
                    </div>
                  )}
                </button>
                {expandedAnalyse === a.id && (
                  <div style={{ paddingBottom: 40, animation: 'fadein 0.3s ease' }}>
                    <div className="analyse-item-full" dangerouslySetInnerHTML={{ __html: renderAnalyseText(a.analyse_text) }} />
                    {isTeamMember && (
                      <button
                        onClick={() => toggleTeamShare(a.id)}
                        disabled={teamShareLoadingId === a.id}
                        style={{
                          marginTop: 16,
                          fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 3,
                          padding: '7px 20px', borderRadius: 999, background: 'none', cursor: 'pointer',
                          border: `1px solid ${sharedAnalyseIds.has(a.id) ? '#44cc88' : '#374151'}`,
                          color: sharedAnalyseIds.has(a.id) ? '#44cc88' : '#9ca3af',
                          transition: 'all 0.15s',
                        }}
                      >
                        {teamShareLoadingId === a.id
                          ? 'BEZIG...'
                          : sharedAnalyseIds.has(a.id)
                          ? '✓ GEDEELD MET MANAGER'
                          : 'DEEL MET MANAGER'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          {savedAnalyses.length > 5 && (
            <div style={{ borderTop: '1px solid #374151', padding: '28px 0', textAlign: 'center' }}>
              <button
                onClick={() => setShowAllAnalyses(v => !v)}
                style={{ background: 'none', border: '1px solid #374151', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3, color: '#9ca3af', padding: '11px 32px', borderRadius: 999, transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#374151'; (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af' }}
              >
                {showAllAnalyses ? 'TOON MINDER ↑' : `TOON ALLE ${savedAnalyses.length} ANALYSES ↓`}
              </button>
            </div>
          )}
          </div>
        )}

        {sorted.length > 0 && (
          <div style={{ borderTop: '1px solid #374151', paddingTop: 40, marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <Link href="/bot" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#f59e0b', textDecoration: 'none' }}>
              ← TERUG NAAR ARNOBOT
            </Link>
            {!showCoachingHint && (
              <Link href="/bot/coaching" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#f59e0b', textDecoration: 'none' }}>
                VERDER NAAR COACHING →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Analyse loading indicator */}
      {analyseLoading && (
        <div className="analyse-loading-bar">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 4, color: '#9ca3af' }}>ARNO ANALYSEERT</span>
        </div>
      )}

      {/* Sticky balk */}
      {hasSelected && !analyseLoading && (
        <div className="delete-bar">
          <span className="delete-bar-count">
            {selected.size} {selected.size === 1 ? 'GESPREK' : 'GESPREKKEN'} GESELECTEERD
          </span>
          <div className="delete-bar-actions">
            <button className="delete-bar-cancel" onClick={() => setSelected(new Set())}>
              ANNULEER
            </button>
            {selected.size >= 3 && (
              <button
                className="delete-bar-outline"
                onClick={() => runAnalyse([...selected])}
                disabled={analyseLoading}
              >
                {analyseLoading ? 'ANALYSEREN...' : 'ANALYSEER →'}
              </button>
            )}
            <button className={selected.size >= 3 ? 'delete-bar-destructive' : 'delete-bar-btn'} onClick={deleteSelected} disabled={deleting}>
              {deleting ? 'VERWIJDEREN...' : 'VERWIJDER →'}
            </button>
          </div>
        </div>
      )}

      {shareUrl && (
        <div
          onClick={() => setShareUrl(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 4, padding: '28px 28px 24px', maxWidth: 480, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>GESPREK DELEN</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: '#f1f5f9', lineHeight: 1.8, marginBottom: 20 }}>
              Iedereen met deze link kan het gesprek lezen. Kopieer de link en deel hem.
            </p>
            <div style={{ background: '#111827', border: '1px solid #374151', padding: '10px 14px', marginBottom: 20, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#9ca3af', flex: 1, wordBreak: 'break-all', lineHeight: 1.6 }}>{shareUrl}</span>
              <button
                onClick={async () => {
                  try { await navigator.clipboard.writeText(shareUrl) } catch {
                    try {
                      const ta = document.createElement('textarea'); ta.value = shareUrl; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
                    } catch {}
                  }
                  setShareCopied(true); setTimeout(() => setShareCopied(false), 2000)
                }}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2, color: shareCopied ? '#111827' : '#f59e0b', background: shareCopied ? '#f59e0b' : 'none', border: '1px solid #f59e0b', padding: '6px 12px', cursor: 'pointer', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}
              >
                {shareCopied ? 'GEKOPIEERD' : 'KOPIEER'}
              </button>
            </div>
            <button
              onClick={() => setShareUrl(null)}
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 3, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              SLUITEN
            </button>
          </div>
        </div>
      )}
    </>
  )
}
