'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/useBreakpoint'
import NotificationBell from '@/app/bot/components/NotificationBell'
import VersionBanner from '@/app/bot/components/VersionBanner'

interface Props {
  active: 'bot' | 'archief' | 'coaching' | 'team' | 'account' | 'profiel' | 'qa'
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

// Instant support tot de eerste 50 betalende gebruikers: één klik naar WhatsApp in plaats van
// dat iemand moet zoeken naar een mailadres. Zelfde nummer als de error-fallbacks door de app.
const SUPPORT_WHATSAPP = 'https://wa.me/31650695999?text=Hoi%20Arno%2C%20ik%20heb%20een%20vraag%20over%20ArnoBot.'

export default function BotNav({ active }: Props) {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const { signOut } = useClerk()
  const router = useRouter()
  const [heeftTeamPlan, setHeeftTeamPlan] = useState(false)
  // Voorkomt dat de TEAM-link op elke pagina zichtbaar "pop-in" doet ná het laden: heeftTeamPlan
  // start op false, dus zonder deze gate verscheen de link altijd met een merkbare vertraging.
  // planLoaded voorkomt niet de vertraging zelf (die zit 'm in de netwerk-fetch), maar zorgt
  // ervoor dat isBouwer nooit ten onrechte "nee" concludeert vóór het antwoord binnen is.
  const [planLoaded, setPlanLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/bot/plan')
      .then(r => r.json())
      .then(d => setHeeftTeamPlan(!!d.commandManager))
      .catch(() => {})
      .finally(() => setPlanLoaded(true))
  }, [])

  // Bewust géén hardgecodeerde bouwer-uitzondering meer (Arno's eigen LinkedIn-account zag
  // TEAM altijd, ongeacht command_manager, verwijderd 2026-08-24 op zijn verzoek): zijn
  // account gedraagt zich nu identiek aan elk ander account, precies zoals bedoeld.
  const isBouwer = planLoaded && heeftTeamPlan

  if (isMobile) {
    return (
      <>
        <style>{`
          .mob-nav { position:fixed;top:0;left:0;right:0;z-index:100;height:56px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(17,24,39,0.97);backdrop-filter:blur(12px); }
          .mob-nav-logo { font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;color:#f1f5f9;text-decoration:none; }
          .mob-nav-logo span { color:#f59e0b; }
          .mob-hamburger { background:none;border:none;cursor:pointer;display:flex;flex-direction:column;gap:5px;padding:8px; }
          .mob-hamburger span { display:block;width:22px;height:2px;background:#f1f5f9; }
          .mob-menu { position:fixed;top:56px;left:0;right:0;z-index:99;background:#111827;border-bottom:1px solid rgba(255,255,255,0.06);padding:24px 28px;display:flex;flex-direction:column;gap:20px;align-items:flex-start; }
          .mob-menu a,.mob-menu span { font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:3px;text-decoration:none; padding-left:16px; }
          .mob-menu a { color:#9ca3af; }
          .mob-menu a:hover { color:#f1f5f9; }
          .mob-menu .mob-flow { text-decoration:underline; text-decoration-color:#f59e0b; text-decoration-thickness:2px; text-underline-offset:6px; }
          .mob-menu .mob-active { color:#f59e0b; }
        `}</style>
        <nav className="mob-nav">
          <Link href="/bot" className="mob-nav-logo">ARNO<span>BOT.</span></Link>
          <button className="mob-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            {menuOpen
              ? <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: '#f59e0b', lineHeight: 1, height: 'auto', width: 'auto', background: 'transparent' }}>✕</span>
              : <><span /><span /><span /></>
            }
          </button>
        </nav>
        {menuOpen && (
          <div className="mob-menu" onClick={() => setMenuOpen(false)}>
            {active === 'bot'      ? <span className="mob-active">ARNOBOT</span>   : <Link href="/bot" className="mob-flow">ARNOBOT</Link>}
            {active === 'archief'  ? <span className="mob-active">ANALYSES</span>  : <Link href="/bot/analyses" className="mob-flow">ANALYSES</Link>}
            {active === 'coaching' ? <span className="mob-active">COACHING</span> : <Link href="/bot/coaching" className="mob-flow">COACHING</Link>}
            {isBouwer && <Link href="/bot/team" className={active === 'team' ? 'mob-active' : 'mob-flow'}>TEAM</Link>}
            {active === 'qa'       ? <span className="mob-active">Q&A</span>      : <Link href="/bot/qa">Q&A</Link>}
            {active === 'account'  ? <span className="mob-active">ACCOUNT</span>  : <Link href="/bot/account">ACCOUNT</Link>}
            <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af' }}>SUPPORT</a>
          </div>
        )}
        <VersionBanner />
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
            : <Link href="/bot" style={{ ...linkBase, textDecoration: 'underline', textDecorationColor: '#f59e0b', textDecorationThickness: '2px', textUnderlineOffset: '6px' }}>ARNOBOT</Link>}
          {active === 'archief'
            ? <span style={{ ...linkBase, color: '#f59e0b' }}>ANALYSES</span>
            : <Link href="/bot/analyses" style={{ ...linkBase, textDecoration: 'underline', textDecorationColor: '#f59e0b', textDecorationThickness: '2px', textUnderlineOffset: '6px' }}>ANALYSES</Link>}
          {active === 'coaching'
            ? <span style={{ ...linkBase, color: '#f59e0b' }}>COACHING</span>
            : <Link href="/bot/coaching" style={{ ...linkBase, textDecoration: 'underline', textDecorationColor: '#f59e0b', textDecorationThickness: '2px', textUnderlineOffset: '6px' }}>COACHING</Link>}
          {isBouwer && (
            <Link href="/bot/team" style={active === 'team' ? { ...linkBase, color: '#f59e0b' } : linkBase}>TEAM</Link>
          )}
          {active === 'qa'
            ? <span style={{ ...linkBase, color: '#f59e0b' }}>Q&A</span>
            : <Link href="/bot/qa" style={linkBase}>Q&A</Link>}
          {active === 'account'
            ? <span style={{ ...linkBase, color: '#f59e0b' }}>ACCOUNT</span>
            : <Link href="/bot/account" style={linkBase}>ACCOUNT</Link>}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 32, alignItems: 'center' }}>
          <NotificationBell />
          <a
            href={SUPPORT_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...logoutBtnStyle, textDecoration: 'none' }}
            onMouseEnter={e => { (e.target as HTMLAnchorElement).style.color = '#f1f5f9' }}
            onMouseLeave={e => { (e.target as HTMLAnchorElement).style.color = '#9ca3af' }}
          >SUPPORT</a>
          <button
            style={logoutBtnStyle}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#f1f5f9' }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#9ca3af' }}
            onClick={() => signOut(() => router.push('/'))}
          >UITLOGGEN</button>
        </div>
      </nav>
      <VersionBanner />
    </>
  )
}
