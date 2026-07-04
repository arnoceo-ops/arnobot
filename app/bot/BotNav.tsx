'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useClerk, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/useBreakpoint'

interface Props {
  active: 'bot' | 'bieb' | 'coaching' | 'team' | 'account' | 'profiel' | 'qa'
}

const navStyle = {
  position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 100,
  padding: '0 40px', height: 64,
  display: 'flex', alignItems: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(17,24,39,0.95)', backdropFilter: 'blur(12px)',
}

const logoutBtnStyle: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3,
  color: '#9ca3af', background: 'none', border: 'none',
  padding: 0, cursor: 'pointer', transition: 'color 0.2s',
}

const linkBase: React.CSSProperties = {
  color: '#9ca3af', textDecoration: 'none',
  fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3,
}

const linkPrimary: React.CSSProperties = {
  ...linkBase,
  borderBottom: '2px solid #f59e0b',
  paddingBottom: 2,
}

export default function BotNav({ active }: Props) {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const { signOut } = useClerk()
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [bouwer, setBouwer] = useState(false)

  useEffect(() => {
    if (isLoaded) setBouwer(user?.primaryEmailAddress?.emailAddress === 'linkedin@royaldutchsales.com')
  }, [isLoaded, user])

  const isBouwer = bouwer

  async function sendFeedback() {
    if (!feedbackText.trim()) return
    setFeedbackLoading(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedbackText }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Er ging iets mis. Probeer opnieuw.')
        return
      }
      setFeedbackSent(true)
      setFeedbackText('')
      setTimeout(() => { setFeedbackOpen(false); setFeedbackSent(false) }, 2000)
    } catch {
      alert('Er ging iets mis. Probeer opnieuw.')
    } finally { setFeedbackLoading(false) }
  }


  const feedbackModal = feedbackOpen && (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={() => setFeedbackOpen(false)}
    >
      <div
        style={{ background: '#1f2937', border: '1px solid #374151', maxWidth: 480, width: '100%', padding: 32 }}
        onClick={e => e.stopPropagation()}
      >
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 1, color: '#f1f5f9', marginBottom: 20 }}>FEEDBACK</h2>
        {feedbackSent ? (
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: '#f59e0b', letterSpacing: 1 }}>Bedankt. Je feedback is verzonden.</p>
        ) : (
          <>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="Wat kan er beter? Wat werkt goed? Alles is welkom."
              style={{ width: '100%', minHeight: 120, background: '#1f2937', border: '1.5px solid #374151', color: '#f1f5f9', fontFamily: "'Space Mono', monospace", fontSize: 13, padding: '12px 16px', resize: 'vertical', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={sendFeedback}
                disabled={feedbackLoading || !feedbackText.trim()}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '12px 36px', background: '#f59e0b', color: '#111827', border: 'none', cursor: 'pointer', borderRadius: 999, opacity: feedbackLoading || !feedbackText.trim() ? 0.5 : 1 }}
              >{feedbackLoading ? '...' : 'VERSTUUR'}</button>
              <button
                onClick={() => setFeedbackOpen(false)}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, padding: '11px 28px', background: 'none', color: '#6b7280', border: '1px solid #374151', cursor: 'pointer', borderRadius: 999 }}
              >ANNULEER</button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <>
        <style>{`
          .mob-nav { position:fixed;top:0;left:0;right:0;z-index:100;height:56px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(17,24,39,0.97);backdrop-filter:blur(12px); }
          .mob-nav-logo { font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;color:#f1f5f9;text-decoration:none; }
          .mob-nav-logo span { color:#f59e0b; }
          .mob-hamburger { background:none;border:none;cursor:pointer;display:flex;flex-direction:column;gap:5px;padding:8px; }
          .mob-hamburger span { display:block;width:22px;height:2px;background:#f1f5f9; }
          .mob-menu { position:fixed;top:56px;left:0;right:0;z-index:99;background:#111827;border-bottom:1px solid rgba(255,255,255,0.06);padding:24px 20px;display:flex;flex-direction:column;gap:20px;align-items:flex-end; }
          .mob-menu a,.mob-menu span { font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;text-decoration:none; }
          .mob-menu a { color:#9ca3af; }
          .mob-menu a:hover { color:#f1f5f9; }
          .mob-menu .mob-active { color:#f59e0b; }
          .mob-menu .mob-primary { border-bottom:2px solid #f59e0b; padding-bottom:2px; }
        `}</style>
        <nav className="mob-nav">
          <Link href="/bot" className="mob-nav-logo">ARNO<span>BOT.</span></Link>
          <button className="mob-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            {menuOpen
              ? <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: '#f59e0b', lineHeight: 1 }}>✕</span>
              : <><span /><span /><span /></>
            }
          </button>
        </nav>
        {menuOpen && (
          <div className="mob-menu" onClick={() => setMenuOpen(false)}>
            {active === 'bot'      ? <span className="mob-active">ARNOBOT</span>   : <Link href="/bot">ARNOBOT</Link>}
            {active === 'bieb'     ? <span className="mob-active">BIEB</span>     : <Link href="/bot/bieb">BIEB</Link>}
            {active === 'coaching' ? <span className="mob-active">COACHING</span> : <Link href="/bot/coaching">COACHING</Link>}
            {isBouwer && (active === 'team' ? <span className="mob-active">TEAM</span> : <Link href="/bot/team">TEAM</Link>)}
            {active === 'qa'       ? <span className="mob-active">Q&A</span>      : <Link href="/bot/qa">Q&A</Link>}
            {active === 'account'  ? <span className="mob-active">ACCOUNT</span>  : <Link href="/bot/account">ACCOUNT</Link>}
            <span style={{ color: '#9ca3af', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setMenuOpen(false); setFeedbackOpen(true) }}>FEEDBACK</span>
          </div>
        )}
        {feedbackModal}
      </>
    )
  }

  return (
    <>
      <nav style={navStyle}>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
          {active === 'bot'
            ? <span style={{ ...linkBase, color: '#f59e0b' }}>ARNOBOT</span>
            : <Link href="/bot" style={linkBase}>ARNOBOT</Link>}
          {active === 'bieb'
            ? <span style={{ ...linkBase, color: '#f59e0b' }}>BIEB</span>
            : <Link href="/bot/bieb" style={linkBase}>BIEB</Link>}
          {active === 'coaching'
            ? <span style={{ ...linkBase, color: '#f59e0b' }}>COACHING</span>
            : <Link href="/bot/coaching" style={linkBase}>COACHING</Link>}
          {isBouwer && (active === 'team'
            ? <span style={{ ...linkBase, color: '#f59e0b' }}>TEAM</span>
            : <Link href="/bot/team" style={linkBase}>TEAM</Link>)}
          {active === 'qa'
            ? <span style={{ ...linkBase, color: '#f59e0b' }}>Q&A</span>
            : <Link href="/bot/qa" style={linkBase}>Q&A</Link>}
          {active === 'account'
            ? <span style={{ ...linkBase, color: '#f59e0b' }}>ACCOUNT</span>
            : <Link href="/bot/account" style={linkBase}>ACCOUNT</Link>}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 32, alignItems: 'center' }}>
          <button
            style={logoutBtnStyle}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#f1f5f9' }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#9ca3af' }}
            onClick={() => setFeedbackOpen(true)}
          >FEEDBACK</button>
          <button
            style={logoutBtnStyle}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#f1f5f9' }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#9ca3af' }}
            onClick={() => signOut(() => router.push('/'))}
          >UITLOGGEN</button>
        </div>
      </nav>
      {feedbackModal}
    </>
  )
}
