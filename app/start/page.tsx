import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Brain, LineChart, MessageSquare, Mic } from 'lucide-react'
import SiteFooter from '../SiteFooter'
import SignupCTA from '../components/SignupCTA'

// Landingpagina voor de folder (QR naar /start?bron=folder-solo), zie docs/FOLDER_PLAN.md.
// Bewust één boodschap en één knop, geen menu: wie scant moet alleen kunnen starten.
// De bron komt uit ?bron= en wordt door PageviewTracker als cookie bewaard.
// Opmaak is een afgeleide van de hoofdpagina (app/page.tsx): zelfde nav, hero, kaarten,
// knop en CTA-band, zodat /start er als dezelfde site uitziet.

export const metadata: Metadata = {
  title: 'ArnoBot: 30 dagen gratis',
  description: 'Sluit meer deals met een coach die je uitdaagt. Probeer ArnoBot 30 dagen gratis.',
  // Alleen bedoeld voor wie de folder heeft, niet voor zoekmachines naast de hoofdpagina.
  robots: { index: false, follow: false },
}

const PUNTEN = [
  { icon: Brain, titel: 'Hij onthoudt', tekst: 'Wat je vorige week zei, weet hij nog. Jij begint nooit meer bij nul.' },
  { icon: Mic, titel: 'Hij spiegelt', tekst: 'Geen standaardadvies, maar eerlijke terugkoppeling op jouw eigen gesprekken. Zo zie je waar je deals blijven hangen.' },
  { icon: MessageSquare, titel: 'Hij laat je oefenen', tekst: 'Sparren tegen een lastige prospect of sceptische CFO, voordat het erop aankomt. Met debrief.' },
  { icon: LineChart, titel: 'Hij laat je groeien', tekst: 'Mindset, systeem en actie in een coachingrapport. Je ziet je voortgang zwart op wit.' },
]

export default async function StartPage() {
  const { userId } = await auth()
  if (userId) redirect('/bot')
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f8fafc; font-family: 'Figtree', sans-serif; font-size: 15px; }

        /* NAV */
        :root { --sai: max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px)); --sab: max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)); }
        body { padding-top: var(--sai); padding-bottom: var(--sab); }
        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100; box-sizing: border-box;
          padding: var(--sai) 40px 0; height: calc(60px + var(--sai)); display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-logo {
          font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px;
          color: #f1f5f9; text-decoration: none;
        }
        .nav-logo span { color: #f59e0b; }

        /* HERO */
        .hero-section { position: relative; padding-top: calc(60px + var(--sai)); }
        .hero-inner {
          position: relative; margin: 0 auto; max-width: 1152px; display: flex; flex-direction: column;
          align-items: center; gap: 48px; padding: 64px 24px 80px;
        }
        .hero-copy { display: flex; flex-direction: column; align-items: center; gap: 24px; text-align: center; max-width: 720px; }
        .hero-eyebrow { font-size: 14px; font-weight: 600; letter-spacing: 0.3em; color: #f59e0b; }
        .hero-h1 {
          font-family: 'Oswald', sans-serif; font-size: 40px; font-weight: 600;
          text-transform: uppercase; line-height: 1.05; color: #f8fafc; text-wrap: balance;
        }
        .hero-h1 span { color: #f59e0b; }
        .hero-sub { max-width: 576px; font-size: 18px; line-height: 1.625; color: #94a3b8; text-wrap: pretty; }
        .hero-cta {
          display: inline-flex; align-items: center; border-radius: 6px; background: #f59e0b;
          padding: 16px 32px; font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 600;
          letter-spacing: 0.1em; color: #111827; text-decoration: none; text-transform: uppercase;
          box-shadow: 0 20px 40px rgba(245,158,11,0.25); transition: transform 0.2s;
        }
        .hero-cta:hover { transform: scale(1.05); }
        .hero-cta:focus-visible { outline: 2px solid #f59e0b; outline-offset: 2px; }

        @media (min-width: 768px) {
          .hero-inner { padding-top: 96px; }
          .hero-h1 { font-size: 60px; }
        }
        @media (min-width: 1024px) {
          .hero-inner { align-items: flex-start; }
          .hero-copy { align-items: flex-start; text-align: left; }
        }

        /* KAARTEN */
        .features-section { margin: 0 auto; max-width: 1152px; padding: 32px 40px 96px; }
        .features-head { margin-bottom: 56px; max-width: 640px; }
        .section-eyebrow { margin-bottom: 12px; font-size: 13px; font-weight: 600; letter-spacing: 0.3em; color: #f59e0b; }
        .section-h2 {
          font-family: 'Oswald', sans-serif; font-size: clamp(30px, 4vw, 48px); font-weight: 600;
          text-transform: uppercase; line-height: 1.15; color: #f8fafc;
        }
        .features-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        .feature-card {
          display: flex; flex-direction: column; gap: 16px; border-radius: 12px; background: #1e293b;
          padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); transition: transform 0.2s;
        }
        .feature-card:hover { transform: translateY(-4px); }
        .feature-card-top { display: flex; align-items: center; justify-content: space-between; }
        .feature-icon {
          display: flex; align-items: center; justify-content: center; width: 48px; height: 48px;
          border-radius: 8px; background: rgba(245,158,11,0.1); color: #f59e0b;
        }
        .feature-index { font-family: 'Oswald', sans-serif; font-size: 36px; font-weight: 600; color: rgba(248,250,252,0.1); }
        .feature-title {
          font-family: 'Oswald', sans-serif; font-size: 20px; font-weight: 500; text-transform: uppercase;
          letter-spacing: 0.02em; color: #f8fafc;
        }
        .feature-desc { line-height: 1.6; color: #94a3b8; }

        /* CTA BAND */
        .cta-band { position: relative; overflow: hidden; padding: 112px 24px; }
        .cta-glow {
          pointer-events: none; position: absolute; inset: 0;
          background: radial-gradient(ellipse 50% 60% at 50% 100%, rgba(245,158,11,0.12), transparent 70%);
        }
        .cta-inner { position: relative; margin: 0 auto; max-width: 768px; display: flex; flex-direction: column; align-items: center; gap: 32px; text-align: center; }
        .cta-h2 {
          font-family: 'Oswald', sans-serif; font-size: 36px; font-weight: 600;
          text-transform: uppercase; line-height: 1.25; color: #f8fafc; text-wrap: balance;
        }
        @media (min-width: 768px) {
          .cta-h2 { font-size: 60px; }
        }
        .cta-sub { max-width: 576px; font-size: 18px; line-height: 1.625; color: #94a3b8; text-wrap: pretty; }
        .cta-btn {
          display: inline-flex; align-items: center; border-radius: 6px; background: #f59e0b;
          padding: 16px 32px; font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 600;
          letter-spacing: 0.1em; color: #111827; text-decoration: none; text-transform: uppercase;
          box-shadow: 0 20px 40px rgba(245,158,11,0.25); transition: transform 0.2s;
        }
        .cta-btn:hover { transform: scale(1.05); }

        /* MOBILE */
        @media (max-width: 768px) {
          .site-nav { padding: var(--sai) 16px 0; }
          .nav-logo { font-size: 18px; letter-spacing: 2px; }
          .features-section { padding: 16px 20px 56px; }
          .features-grid { grid-template-columns: 1fr; }
          .cta-band { padding: 64px 20px; }
        }
      `}</style>

      {/* NAV */}
      <nav className="site-nav">
        <Link href="/" className="nav-logo">ARNO<span>BOT.</span></Link>
      </nav>

      {/* HERO */}
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="hero-eyebrow">AI SALES COACH</p>
            <h1 className="hero-h1">Sluit meer deals met een coach die <span>je uitdaagt</span></h1>
            <p className="hero-sub">Probeer ArnoBot 30 dagen gratis. Daarna maak je zelf een keuze.</p>
            <SignupCTA className="hero-cta">30 dagen gratis</SignupCTA>
          </div>
        </div>
      </section>

      {/* PUNTEN */}
      <section className="features-section">
        <div className="features-head">
          <p className="section-eyebrow">WAT ARNOBOT DOET</p>
          <h2 className="section-h2">Gebouwd op de methode van Arno Diepeveen</h2>
        </div>
        <div className="features-grid">
          {PUNTEN.map((punt, index) => {
            const Icon = punt.icon
            return (
              <div key={punt.titel} className="feature-card">
                <div className="feature-card-top">
                  <div className="feature-icon"><Icon size={24} aria-hidden="true" /></div>
                  <span className="feature-index">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="feature-title">{punt.titel}</h3>
                <p className="feature-desc">{punt.tekst}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA BAND */}
      <section className="cta-band">
        <div className="cta-glow" aria-hidden="true" />
        <div className="cta-inner">
          <h2 className="cta-h2">Probeer het 30 dagen gratis.</h2>
          <p className="cta-sub">Start met ArnoBot. Geen creditcard nodig, geen verplichtingen. Alleen betere salesgesprekken.</p>
          <SignupCTA className="cta-btn">30 dagen gratis</SignupCTA>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
