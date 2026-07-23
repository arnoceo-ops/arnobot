import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import SiteFooter from '../SiteFooter'
import PrijzenPreviewClient from './PrijzenPreviewClient'

export const metadata: Metadata = {
  title: 'ArnoBot: Prijzen (preview)',
  robots: { index: false, follow: false },
}

export default async function PrijzenPreviewPage() {
  const { userId } = await auth()
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@300;600;900&family=DM+Sans:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'DM Sans', sans-serif; font-size: 15px; }

        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 40px; height: 60px; display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-logo {
          font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px;
          color: #f1f5f9; text-decoration: none;
        }
        .nav-logo span { color: #f59e0b; }
        .nav-spacer { flex: 1; }
        .nav-auth { display: flex; gap: 32px; align-items: center; }
        .nav-login {
          font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px;
          color: #9ca3af; text-decoration: none; transition: color 0.2s;
        }
        .nav-login:hover { color: #f1f5f9; }
        .nav-cta-btn {
          font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px;
          color: #111827; text-decoration: none; background: #f59e0b;
          padding: 8px 20px; border-radius: 999px; transition: background 0.2s;
        }
        .nav-cta-btn:hover { background: #d97706; }

        .prijzen-hero { padding: 160px 60px 40px; text-align: center; }
        .prijzen-label {
          font-family: 'DM Sans', sans-serif; font-size: 13px; letter-spacing: 4px;
          text-transform: uppercase; color: #f59e0b; margin-bottom: 16px;
        }
        .prijzen-title {
          font-family: 'Barlow Condensed', sans-serif; font-size: clamp(36px, 5vw, 56px); font-weight: 600;
          text-transform: uppercase; letter-spacing: 1px; color: #f1f5f9; margin-bottom: 16px;
        }
        .prijzen-sub { font-family: 'DM Sans', sans-serif; font-size: 16px; color: #9ca3af; max-width: 480px; margin: 0 auto; }

        .prijzen-section { padding: 0 60px 80px; }

        .prijzen-trust-row {
          display: flex; flex-wrap: wrap; justify-content: center; gap: 32px;
          max-width: 820px; margin: 40px auto 0; padding-top: 24px; border-top: 1px solid #374151;
        }
        .prijzen-trust-item { font-family: 'DM Sans', sans-serif; font-size: 13px; color: #9ca3af; letter-spacing: 0.3px; }
        .prijzen-trust-item::before { content: '✓ '; color: #f59e0b; }

        .prijzen-preview-badge {
          text-align: center; font-family: 'DM Sans', sans-serif; font-size: 12px;
          letter-spacing: 2px; text-transform: uppercase; color: #6b7280;
          padding-top: 76px;
        }

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
            : <>
                <Link href="/sign-in" className="nav-login">INLOGGEN</Link>
                <Link href="/sign-up" className="nav-cta-btn">30 DAGEN GRATIS</Link>
              </>
          }
        </div>
      </nav>

      <p className="prijzen-preview-badge">Preview, nog niet live</p>

      <section className="prijzen-hero">
        <p className="prijzen-label">Prijzen</p>
        <h1 className="prijzen-title">Transparant. Geen addertjes.</h1>
        <p className="prijzen-sub">30 dagen gratis proberen, daarna kies je het niveau dat bij je past.</p>
      </section>

      <section className="prijzen-section">
        <PrijzenPreviewClient />

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
