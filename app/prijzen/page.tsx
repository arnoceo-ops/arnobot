import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import SiteFooter from '../SiteFooter'
import PrijzenClient from './PrijzenClient'

export const metadata: Metadata = {
  title: 'ArnoBot: Prijzen',
  description: 'Transparante prijzen voor je AI-salescoach. 30 dagen gratis, daarna vanaf €97 per maand.',
  robots: { index: true, follow: true },
}

export default async function PrijzenPage() {
  const { userId } = await auth()
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;600&family=Figtree:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f8fafc; font-family: 'Figtree', sans-serif; font-size: 15px; }

        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 40px; height: 60px; display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-logo {
          font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px;
          color: #f1f5f9; text-decoration: none;
        }
        .nav-logo span { color: #f59e0b; }
        .nav-spacer { flex: 1; }
        .nav-auth { display: flex; gap: 32px; align-items: center; }
        .nav-login {
          font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px;
          color: #9ca3af; text-decoration: none; transition: color 0.2s;
        }
        .nav-login:hover { color: #f1f5f9; }

        .prijzen-hero { padding: 160px 60px 40px; text-align: center; }
        .prijzen-label {
          font-size: 14px; font-weight: 600; letter-spacing: 0.3em;
          text-transform: uppercase; color: #f59e0b; margin-bottom: 16px;
        }
        .prijzen-title {
          font-family: 'Oswald', sans-serif; font-size: clamp(36px, 5vw, 56px); font-weight: 600;
          text-transform: uppercase; line-height: 1.1; color: #f8fafc; margin-bottom: 16px;
        }
        .prijzen-sub { font-size: 18px; line-height: 1.625; color: #94a3b8; max-width: 480px; margin: 0 auto; }

        .prijzen-section { padding: 0 60px 80px; }

        .prijzen-trust-row {
          display: flex; flex-wrap: wrap; justify-content: center; gap: 32px;
          max-width: 820px; margin: 56px auto 0; padding-top: 24px; border-top: 1px solid #374151;
        }
        .prijzen-trust-item { font-size: 13px; color: #94a3b8; letter-spacing: 0.3px; }
        .prijzen-trust-item::before { content: '✓ '; color: #f59e0b; }

        @media (max-width: 768px) {
          .prijzen-hero { padding: 120px 24px 32px; }
          .prijzen-section { padding: 0 24px 56px; }
        }
      `}</style>

      <nav className="site-nav">
        <Link href="/" className="nav-logo">ARNO<span>BOT.</span></Link>
        <div className="nav-spacer" />
        <div className="nav-auth">
          {userId
            ? <Link href="/bot" className="nav-login">MIJN BOT</Link>
            : <Link href="/sign-in" className="nav-login">LOGIN</Link>
          }
        </div>
      </nav>

      <section className="prijzen-hero">
        <p className="prijzen-label">Prijzen</p>
        <h1 className="prijzen-title">Transparant. Geen addertjes.</h1>
        <p className="prijzen-sub">30 dagen gratis, daarna maak je een definitieve keuze.</p>
      </section>

      <section className="prijzen-section">
        <PrijzenClient />

        <div className="prijzen-trust-row">
          <span className="prijzen-trust-item">Privé & versleuteld opgeslagen</span>
          <span className="prijzen-trust-item">Nooit gedeeld met derden</span>
          <span className="prijzen-trust-item">Maandelijks opzegbaar</span>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
