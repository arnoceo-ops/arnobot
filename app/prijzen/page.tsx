import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import SiteFooter from '../SiteFooter'

export const metadata: Metadata = {
  title: 'ArnoBot: Prijzen',
  description: 'Transparante prijzen voor je AI-salescoach. 30 dagen gratis, daarna €77 per maand of €697 per jaar.',
  robots: { index: true, follow: true },
}

export default async function PrijzenPage() {
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
        .prijzen-grid {
          max-width: 760px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
        }
        .prijzen-card {
          background: #1e293b; border: 1px solid #374151; border-radius: 8px; padding: 32px;
          display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center;
        }
        .prijzen-card-label {
          font-size: 15px; letter-spacing: 3px; text-transform: uppercase; color: #f59e0b;
          font-family: 'Bebas Neue', sans-serif;
        }
        .prijzen-amount { display: flex; align-items: baseline; gap: 6px; }
        .prijzen-currency { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #6b7280; }
        .prijzen-num { font-family: 'Bebas Neue', sans-serif; font-size: clamp(48px, 5vw, 64px); color: #f1f5f9; letter-spacing: -1px; line-height: 0.9; }
        .prijzen-cta {
          display: inline-block; text-decoration: none; text-align: center;
          background: #f59e0b; color: #1e293b; font-family: 'Bebas Neue', sans-serif;
          font-size: 18px; letter-spacing: 2px; padding: 12px 32px; border-radius: 999px;
          transition: background 0.2s;
        }
        .prijzen-cta:hover { background: #d97706; }
        .prijzen-trial { font-size: 13px; color: #6b7280; font-family: 'DM Sans', sans-serif; }

        .prijzen-team {
          max-width: 760px; margin: 40px auto 0; border-top: 1px solid #374151; padding-top: 32px;
          display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center;
        }
        .prijzen-team-text { font-family: 'DM Sans', sans-serif; font-size: 14px; color: #9ca3af; }
        .prijzen-team-link {
          font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px;
          color: #f59e0b; text-decoration: none;
        }

        .prijzen-trust-row {
          display: flex; flex-wrap: wrap; justify-content: center; gap: 32px;
          max-width: 760px; margin: 32px auto 0; padding-top: 24px; border-top: 1px solid #374151;
        }
        .prijzen-trust-item { font-family: 'DM Sans', sans-serif; font-size: 13px; color: #9ca3af; letter-spacing: 0.3px; }
        .prijzen-trust-item::before { content: '✓ '; color: #f59e0b; }

        @media (max-width: 768px) {
          .prijzen-hero { padding: 120px 24px 32px; }
          .prijzen-section { padding: 0 24px 56px; }
          .prijzen-grid { grid-template-columns: 1fr; }
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

      <section className="prijzen-hero">
        <p className="prijzen-label">Prijzen</p>
        <h1 className="prijzen-title">Transparant. Geen addertjes.</h1>
        <p className="prijzen-sub">30 dagen gratis proberen, daarna kies je zelf: per maand of per jaar.</p>
      </section>

      <section className="prijzen-section">
        <div className="prijzen-grid">
          <div className="prijzen-card">
            <span className="prijzen-card-label">Per maand</span>
            <div className="prijzen-amount">
              <span className="prijzen-currency">€</span>
              <span className="prijzen-num">77</span>
            </div>
            <Link href="/sign-up" className="prijzen-cta">START NU.</Link>
            <span className="prijzen-trial">30 dagen gratis</span>
          </div>
          <div className="prijzen-card">
            <span className="prijzen-card-label">Per jaar <span style={{ color: '#6b7280', textTransform: 'none', letterSpacing: 0 }}>(3 mnd gratis)</span></span>
            <div className="prijzen-amount">
              <span className="prijzen-currency">€</span>
              <span className="prijzen-num">697</span>
            </div>
            <Link href="/sign-up" className="prijzen-cta">START NU.</Link>
            <span className="prijzen-trial">30 dagen gratis</span>
          </div>
        </div>

        <div className="prijzen-team">
          <span className="prijzen-team-text">Wil je je hele salesteam uitrusten met ArnoBot als persoonlijke coach?</span>
          <a href="mailto:arno@arno.bot" className="prijzen-team-link">Neem contact op →</a>
        </div>

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
