import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Brain, LineChart, MessageSquare, Mic, Target, Zap } from 'lucide-react'
import HeroWordRotator from './HeroWordRotator'
import HomeTestimonialCarousel from './HomeTestimonialCarousel'
import SiteFooter from './SiteFooter'

const FEATURES = [
  {
    icon: Mic,
    title: 'Gespreksanalyse',
    description: 'ArnoBot luistert mee en geeft na elk gesprek concrete feedback op je aanpak.',
  },
  {
    icon: Target,
    title: 'Dagelijkse focus',
    description: 'Elke ochtend een scherp actieplan, afgestemd op jouw pipeline en targets.',
  },
  {
    icon: MessageSquare,
    title: 'Pitch-training',
    description: 'Oefen bezwaren en pitches met realistische rollenspellen, wanneer jij wilt.',
  },
  {
    icon: LineChart,
    title: 'Pipeline-inzicht',
    description: 'Zie in één oogopslag welke deals aandacht nodig hebben en waarom.',
  },
  {
    icon: Brain,
    title: 'Persoonlijke coaching',
    description: 'Coaching die zich aanpast aan jouw stijl, ervaring en verbeterpunten.',
  },
  {
    icon: Zap,
    title: 'Direct resultaat',
    description: 'Gebruikers zien gemiddeld binnen 30 dagen een meetbaar hogere conversie.',
  },
]

const STATS = [
  { value: '+38%', label: 'gemiddeld hogere conversie' },
  { value: '12.000+', label: 'gecoachte salesgesprekken' },
  { value: '4,8/5', label: 'beoordeling door gebruikers' },
]

export const metadata: Metadata = {
  title: 'ArnoBot: Jouw AI Sales Coach',
  description: 'ArnoBot is de AI sales coach die salesprofessionals en teams elke dag scherper maakt. Meer omzet, betere gesprekken, hogere conversie. Probeer 30 dagen gratis.',
  robots: { index: true, follow: true },
}

export default async function ArnoBotLandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/bot')
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;600&family=Figtree:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f8fafc; font-family: 'Figtree', sans-serif; font-size: 15px; }

        /* NAV */
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
        .nav-cta-btn {
          font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px;
          color: #111827; text-decoration: none; background: #f59e0b;
          padding: 8px 20px; border-radius: 999px; transition: background 0.2s;
        }
        .nav-cta-btn:hover { background: #d97706; }

        /* HERO */
        .hero-section { position: relative; }
        .hero-inner {
          position: relative; margin: 0 auto; max-width: 1152px; display: flex; flex-direction: column;
          align-items: center; gap: 48px; padding: 64px 24px 80px;
        }
        .hero-copy { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 24px; text-align: center; }
        .hero-eyebrow { font-size: 14px; font-weight: 600; letter-spacing: 0.3em; color: #f59e0b; }
        .hero-h1 {
          font-family: 'Oswald', sans-serif; font-size: 48px; font-weight: 600;
          text-transform: uppercase; line-height: 1.05; color: #f8fafc; text-wrap: balance;
        }
        .hero-word-rotator-wrap { position: relative; display: inline-block; }
        .hero-word-rotator { display: inline-block; color: #f59e0b; animation: hero-word-in 0.5s ease; }
        @keyframes hero-word-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-sub { max-width: 576px; font-size: 18px; line-height: 1.625; color: #94a3b8; text-wrap: pretty; }
        .hero-cta {
          display: inline-flex; align-items: center; border-radius: 6px; background: #f59e0b;
          padding: 16px 32px; font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 600;
          letter-spacing: 0.1em; color: #111827; text-decoration: none; text-transform: uppercase;
          box-shadow: 0 20px 40px rgba(245,158,11,0.25); transition: transform 0.2s;
        }
        .hero-cta:hover { transform: scale(1.05); }
        .hero-cta:focus-visible { outline: 2px solid #f59e0b; outline-offset: 2px; }
        .hero-photo-col { position: relative; flex: 1; width: 100%; }

        @media (min-width: 768px) {
          .hero-inner { padding-top: 96px; }
          .hero-h1 { font-size: 60px; }
        }

        @media (min-width: 1024px) {
          .hero-inner { flex-direction: row; align-items: flex-end; gap: 32px; padding-bottom: 0; }
          .hero-copy { align-items: flex-start; text-align: left; padding-bottom: 96px; }
          .hero-cta { align-self: flex-start; }
          .hero-photo-col { max-width: 448px; }
        }

        .hero-photo {
          position: relative; width: 100%; aspect-ratio: 3 / 4; display: block;
          border-radius: 24px; object-fit: cover;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }

        /* FEATURE GRID */
        .features-section { margin: 0 auto; max-width: 1152px; padding: 96px 40px; }
        .features-head { margin-bottom: 56px; max-width: 640px; }
        .section-eyebrow { margin-bottom: 12px; font-size: 13px; font-weight: 600; letter-spacing: 0.3em; color: #f59e0b; }
        .section-h2 {
          font-family: 'Oswald', sans-serif; font-size: clamp(30px, 4vw, 48px); font-weight: 600;
          text-transform: uppercase; line-height: 1.15; color: #f8fafc;
        }
        .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
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

        /* STATS BAND */
        .stats-band { max-width: 1152px; margin: 96px auto; padding: 0 40px; }
        .stats-card {
          background: #faf6ef; border-radius: 24px; padding: 64px 48px;
          display: grid; grid-template-columns: repeat(3, 1fr); text-align: center;
        }
        .stats-card > div { padding: 0 24px; }
        .stats-card > div:not(:first-child) { border-left: 1px solid #e5ddd0; }
        .stat-num { font-family: 'Oswald', sans-serif; font-size: clamp(36px, 4vw, 48px); font-weight: 600; color: #d98b0f; }
        .stat-label { font-size: 15px; font-weight: 500; color: #6b6456; margin-top: 8px; }

        /* TESTIMONIALS */
        .testimonial-section { margin: 0 auto; max-width: 1152px; padding: 96px 40px; }
        .htc-header { margin-bottom: 56px; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 24px; }
        .testimonial-label { margin-bottom: 12px; font-size: 13px; font-weight: 600; letter-spacing: 0.3em; color: #f59e0b; }
        .testimonial-heading {
          font-family: 'Oswald', sans-serif; font-size: clamp(30px, 4vw, 48px); font-weight: 600;
          text-transform: uppercase; line-height: 1.15; color: #f8fafc;
        }
        .htc-nav { display: flex; gap: 12px; }
        .htc-nav-btn {
          display: flex; align-items: center; justify-content: center; width: 48px; height: 48px;
          border-radius: 999px; border: 1px solid rgba(255,255,255,0.1); background: none; color: #f8fafc;
          cursor: pointer; transition: background 0.2s;
        }
        .htc-nav-btn:hover { background: #1e293b; }
        .htc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .htc-card {
          display: flex; flex-direction: column; gap: 24px; border-radius: 12px; padding: 32px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2); transition: all 0.5s;
        }
        .htc-card-active { transform: scale(1.02); background: #1e293b; box-shadow: 0 0 0 1px rgba(245,158,11,0.4), 0 10px 30px rgba(0,0,0,0.2); }
        .htc-card-inactive { background: rgba(30,41,59,0.5); opacity: 0.6; }
        .htc-quote { flex: 1; line-height: 1.6; color: #f8fafc; }
        .htc-name { font-weight: 600; color: #f8fafc; }
        .htc-role { font-size: 13px; color: #94a3b8; margin-top: 2px; }
        .htc-dots { margin-top: 32px; display: flex; justify-content: center; gap: 8px; }
        .htc-dot { height: 8px; width: 8px; border-radius: 999px; border: none; background: rgba(148,163,184,0.4); cursor: pointer; transition: all 0.2s; }
        .htc-dot-active { width: 32px; background: #f59e0b; }

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
          .site-nav { padding: 0 16px; }
          .nav-logo { font-size: 18px; letter-spacing: 2px; }
          .nav-auth { gap: 10px; }
          .nav-login { font-size: 16px; letter-spacing: 2px; }

          .features-section { padding: 56px 20px; }
          .features-grid { grid-template-columns: 1fr; }
          .stats-band { margin: 56px auto; padding: 0 16px; }
          .stats-card { grid-template-columns: 1fr; padding: 40px 24px; gap: 32px; }
          .stats-card > div:not(:first-child) { border-left: none; padding-top: 0; }
          .testimonial-section { padding: 56px 20px; }
          .htc-grid { grid-template-columns: 1fr; }
          .cta-band { padding: 64px 20px; }
        }
      `}</style>

      {/* NAV */}
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

      {/* HERO */}
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="hero-eyebrow">AI SALES COACH</p>
            <h1 className="hero-h1">
              Elke dag dichter bij<br />
              <HeroWordRotator />
            </h1>
            <p className="hero-sub">
              ArnoBot coacht je door elk salesgesprek, elke pipeline-review en elke deal. Persoonlijke AI-coaching op het niveau van een topcoach, altijd beschikbaar, altijd scherp.
            </p>
            <a href="/sign-up" className="hero-cta">30 dagen gratis</a>
          </div>
          <div className="hero-photo-col">
            <img src="/cyborg.jpg" alt="Arno Diepeveen" className="hero-photo" />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section">
        <div className="features-head">
          <p className="section-eyebrow">WAT ARNOBOT DOET</p>
          <h2 className="section-h2">Een topcoach in je broekzak</h2>
        </div>
        <div className="features-grid">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={feature.title} className="feature-card">
                <div className="feature-card-top">
                  <div className="feature-icon"><Icon size={24} aria-hidden="true" /></div>
                  <span className="feature-index">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* STATS BAND */}
      <section className="stats-band">
        <div className="stats-card">
          {STATS.map(stat => (
            <div key={stat.label}>
              <p className="stat-num">{stat.value}</p>
              <p className="stat-label">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonial-section">
        <HomeTestimonialCarousel />
      </section>

      {/* CTA BAND */}
      <section className="cta-band" id="cta">
        <div className="cta-glow" aria-hidden="true" />
        <div className="cta-inner">
          <h2 className="cta-h2">Straks vragen ze hoe je het deed.</h2>
          <p className="cta-sub">Start met ArnoBot. Geen creditcard nodig, geen verplichtingen. Alleen betere salesgesprekken.</p>
          <a href="/sign-up" className="cta-btn">30 dagen gratis</a>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
