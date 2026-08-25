'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type UserRow = { userId: string; naam: string; email: string | null }
type UserInfo = { naam: string; email: string | null; plan: string; isTeamManager: boolean; isTeamLid: boolean; teamNaam: string | null }
type Analyse = { text: string; updatedAt: string }
type ChatMessage = { role: 'admin' | 'arnobot'; content: string }

function formatBijgewerkt(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export default function AnalyseClient({ initialUserId }: { initialUserId: string | null }) {
  const router = useRouter()

  const [users, setUsers] = useState<UserRow[]>([])
  const [query, setQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [analyse, setAnalyse] = useState<Analyse | null>(null)
  const [loadingAnalyse, setLoadingAnalyse] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/admin/analyse/users')
      .then(r => r.json())
      .then(d => setUsers(d.users ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedUserId) loadUser(selectedUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users.slice(0, 30)
    return users.filter(u => u.naam.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)).slice(0, 30)
  }, [users, query])

  async function loadUser(userId: string) {
    setSelectedUserId(userId)
    setUserInfo(null)
    setAnalyse(null)
    setChatMessages([])
    setLoadError(false)
    setLoadingAnalyse(true)
    router.replace(`/bot/admin/analyse?userId=${userId}`, { scroll: false })

    try {
      const res = await fetch(`/api/admin/analyse?userId=${userId}`)
      const data = await res.json()
      if (!res.ok) { setLoadError(true); setLoadingAnalyse(false); return }
      setUserInfo(data.user)
      if (data.analyse) {
        setAnalyse(data.analyse)
        setLoadingAnalyse(false)
      } else {
        await generateAnalyse(userId, false)
      }
    } catch {
      setLoadError(true)
      setLoadingAnalyse(false)
    }
  }

  async function generateAnalyse(userId: string, isRegenerate: boolean) {
    if (isRegenerate) setRegenerating(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/admin/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) { setLoadError(true); return }
      setUserInfo(data.user)
      setAnalyse(data.analyse)
      setChatMessages([])
    } catch {
      setLoadError(true)
    } finally {
      setLoadingAnalyse(false)
      setRegenerating(false)
    }
  }

  function terugNaarZoeken() {
    setSelectedUserId(null)
    setUserInfo(null)
    setAnalyse(null)
    setChatMessages([])
    router.replace('/bot/admin/analyse', { scroll: false })
  }

  async function stelVervolgvraag() {
    const vraag = chatInput.trim()
    if (!vraag || chatLoading || !selectedUserId) return
    const nieuweGeschiedenis = [...chatMessages, { role: 'admin' as const, content: vraag }]
    setChatMessages(nieuweGeschiedenis)
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/admin/analyse-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          question: vraag,
          history: chatMessages,
          analyse: analyse?.text ?? '',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.antwoord) {
        setChatMessages(prev => [...prev, { role: 'arnobot', content: 'Dit antwoord kon niet gegenereerd worden. Probeer de vraag opnieuw.' }])
      } else {
        setChatMessages(prev => [...prev, { role: 'arnobot', content: data.antwoord }])
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'arnobot', content: 'Dit antwoord kon niet gegenereerd worden. Probeer de vraag opnieuw.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'sans-serif', fontSize: 14, fontWeight: 400, padding: '12px 16px',
    borderRadius: 4, border: '1.5px solid #374151', background: '#111827', color: '#f1f5f9', outline: 'none', width: '100%',
  }

  const knopStyle: React.CSSProperties = {
    fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, fontWeight: 700, color: '#f59e0b',
    background: 'none', border: '1px solid #f59e0b', borderRadius: 4, padding: '8px 16px', cursor: 'pointer',
  }

  // Landingstate: nog geen gebruiker geselecteerd, zoekveld + resultatenlijst.
  if (!selectedUserId) {
    return (
      <div className="admin-content" style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
        <p style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: 48, fontWeight: 700, margin: '0 0 8px 0', letterSpacing: -1 }}>Analyse</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 32 }}>
          Zoek een gebruiker op en krijg een briefing op basis van al zijn gesprekken, coachingdata en teamdata, met ruimte om door te vragen.
        </p>

        <input
          autoFocus
          type="text"
          placeholder="Zoek op naam of e-mail..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <div style={{ background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
          {filteredUsers.length === 0 && (
            <p style={{ fontSize: 14, color: '#6b7280', padding: 20 }}>Geen gebruikers gevonden.</p>
          )}
          {filteredUsers.map(u => (
            <button
              key={u.userId}
              onClick={() => loadUser(u.userId)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                borderBottom: '1px solid #111827', padding: '14px 20px', cursor: 'pointer',
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{u.naam}</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0 0' }}>{u.email ?? 'geen e-mail'}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-content" style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
      <button onClick={terugNaarZoeken} style={{ ...knopStyle, marginBottom: 24 }}>← ANDERE GEBRUIKER</button>

      {userInfo && (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 48, fontWeight: 700, margin: '0 0 8px 0', letterSpacing: -1 }}>{userInfo.naam}</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            {userInfo.email ?? 'geen e-mail'} · {userInfo.plan}
            {userInfo.isTeamManager && userInfo.teamNaam && ` · teambaas van ${userInfo.teamNaam}`}
            {userInfo.isTeamLid && userInfo.teamNaam && ` · teamlid van ${userInfo.teamNaam}`}
          </p>
        </div>
      )}

      <div style={{ background: '#1f2937', borderRadius: 4, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#f59e0b', margin: 0 }}>ANALYSE</p>
            {analyse && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>bijgewerkt {formatBijgewerkt(analyse.updatedAt)}</p>}
          </div>
          {analyse && !loadingAnalyse && (
            <button onClick={() => generateAnalyse(selectedUserId, true)} disabled={regenerating} style={{ ...knopStyle, opacity: regenerating ? 0.5 : 1 }}>
              {regenerating ? 'BEZIG...' : 'VERNIEUW'}
            </button>
          )}
        </div>

        {loadingAnalyse && (
          <p style={{ fontSize: 14, color: '#6b7280' }}>Analyse wordt gegenereerd, dit duurt een moment...</p>
        )}
        {loadError && !loadingAnalyse && (
          <p style={{ fontSize: 14, color: '#cc4444' }}>Dit kon niet geladen worden. Probeer het opnieuw.</p>
        )}
        {analyse && !loadingAnalyse && (
          <p style={{ fontSize: 14, lineHeight: 1.9, color: '#f1f5f9', whiteSpace: 'pre-wrap', margin: 0 }}>{analyse.text}</p>
        )}
      </div>

      {analyse && !loadingAnalyse && (
        <div style={{ background: '#1f2937', borderRadius: 4, padding: 24 }}>
          <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 3, color: '#f59e0b', marginBottom: 16 }}>DOORVRAGEN</p>

          {chatMessages.length === 0 && (
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>Stel een vervolgvraag over deze gebruiker, bijvoorbeeld waarom een patroon zich voordoet of wat een goede opening is voor het gesprek.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: chatMessages.length ? 20 : 0 }}>
            {chatMessages.map((m, i) => (
              <div key={i}>
                <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, fontWeight: 700, color: m.role === 'admin' ? '#6b7280' : '#f59e0b', marginBottom: 4 }}>
                  {m.role === 'admin' ? 'JIJ' : 'ARNOBOT'}
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.9, color: '#f1f5f9', whiteSpace: 'pre-wrap', margin: 0 }}>{m.content}</p>
              </div>
            ))}
            {chatLoading && (
              <div>
                <p style={{ fontFamily: 'sans-serif', fontSize: 12, letterSpacing: 2, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>ARNOBOT</p>
                <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>denkt na...</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Stel een vervolgvraag..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') stelVervolgvraag() }}
              disabled={chatLoading}
              style={inputStyle}
            />
            <button onClick={stelVervolgvraag} disabled={chatLoading || !chatInput.trim()} style={{ ...knopStyle, opacity: (chatLoading || !chatInput.trim()) ? 0.5 : 1, whiteSpace: 'nowrap' }}>
              VRAAG →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
