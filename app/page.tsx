import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { client } from '@/sanity/client'
import HeroWordRotator from './HeroWordRotator'

type Testimonial = { _id: string; quote: string; name: string; role?: string }

// Vaste aanbevelingen over Arno's expertise (met toestemming, ook publiek op arno.blog/bio).
// Toekomstige productgebruikers-testimonials uit Sanity komen hier gewoon bij.
const FIXED_TESTIMONIALS: Testimonial[] = [
  {
    _id: 'fixed-harvey-lee',
    quote: "Arno's ability to challenge the status quo and offer of different thinking is one of his key attributes as well as his focus on the desired outcomes.",
    name: 'Harvey Lee',
    role: 'Head of Product Marketing @ Epson',
  },
  {
    _id: 'fixed-richard-maddocks',
    quote: "Arno is one-of-a-kind in the world of sales. In my 40+ years of being involved in commercial activities, he stands out as 'the best in his field'.",
    name: 'Richard Maddocks',
    role: 'Trainer & Author of The Energy Book',
  },
  {
    _id: 'fixed-stephan-bosman',
    quote: 'Arno facilitated Neomax with his knowledge & expertise which resulted in achieving our targets to do business with 60% of the Top 500 companies within 5 years.',
    name: 'Stephan Bosman',
    role: 'Managing Director @ Neomax',
  },
]

async function getTestimonials(): Promise<Testimonial[]> {
  const dynamic: Testimonial[] = await client.fetch(`*[_type == "testimonial"] | order(_createdAt desc)`, {}, { next: { revalidate: 0 } })
  return [...FIXED_TESTIMONIALS, ...dynamic]
}

export const metadata: Metadata = {
  title: 'ArnoBot: Jouw persoonlijke Sales Coach',
  description: 'Geen generieke AI. Decennia bewezen sales-expertise, 24/7 beschikbaar.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'ArnoBot: Sales coaching die nooit slaapt',
    description: 'ArnoBot is jouw AI-salescoach, 24/7 beschikbaar. Gebouwd op decennia bewezen verkoopexpertise, geen generieke motivatiepraat.',
    url: 'https://arno.bot',
    siteName: 'ArnoBot',
    locale: 'nl_NL',
    type: 'website',
    images: [{ url: 'https://arno.bot/cyborg.jpg', width: 380, height: 380, alt: 'ArnoBot: AI-salescoach' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArnoBot: Sales coaching die nooit slaapt',
    description: 'ArnoBot is jouw AI-salescoach, 24/7 beschikbaar. Gebouwd op decennia bewezen verkoopexpertise, geen generieke motivatiepraat.',
    images: ['https://arno.bot/cyborg.jpg'],
  },
}

export default async function ArnoBotLandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/bot')
  const testimonials = await getTestimonials()
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@300;600;900&family=DM+Sans:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #1e293b; color: #f1f5f9; font-family: 'DM Sans', sans-serif; font-size: 15px; }

        /* ── NAV ── */
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
        .nav-auth {
          display: flex; gap: 32px; align-items: center;
        }
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

        /* ── CANVAS (light sections) ── */
        .canvas-section {
          background: #f1f5f9; display: grid; grid-template-columns: 1fr 1fr;
          border-top: 3px solid #f59e0b;
        }
        .canvas-left {
          padding: 80px 60px; border-right: 1px solid #ddd; display: flex;
          align-items: flex-start; justify-content: flex-end;
        }
        .canvas-left-inner { max-width: 540px; width: 100%; }
        .canvas-quote {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(40px, 4vw, 64px);
          line-height: 1.05; color: #1e293b;
          border-right: 4px solid #f59e0b; padding-right: 32px;
          text-align: right;
        }
        .canvas-quote em { font-style: normal; color: #f59e0b; }
        .canvas-right {
          padding: 80px 60px; display: flex; flex-direction: column;
          justify-content: flex-start; gap: 24px;
        }
        .canvas-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(40px, 4vw, 64px);
          line-height: 1.05; color: #1e293b; letter-spacing: 1px;
        }
        .canvas-body { font-family: 'DM Sans', sans-serif; font-size: 16px; line-height: 1.85; color: #6b7280; max-width: 420px; }
        .canvas-link {
          display: block; color: #f59e0b; text-decoration: none;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 24px; letter-spacing: 3px; text-transform: uppercase;
          margin-top: 16px; background: #111827;
          padding: 14px 18px; border: none; border-radius: 999px;
          width: 380px; max-width: 100%; text-align: center; transition: background 0.2s;
        }
        .canvas-link:hover { background: #1e293b; }

        /* ── SUBSCRIBE (dark sections) ── */
        .subscribe-section {
          background: #1e293b; color: #f1f5f9;
          display: grid; grid-template-columns: 1fr 1fr;
          border-top: 3px solid #f59e0b;
        }
        .subscribe-text-col {
          padding: 80px 60px; border-right: 1px solid #374151;
          display: flex; align-items: flex-start; justify-content: flex-end;
        }
        .subscribe-text-inner { max-width: 540px; width: 100%; display: flex; flex-direction: column; gap: 16px; text-align: right; }
        .subscribe-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(40px, 4vw, 64px);
          line-height: 1.05; letter-spacing: 1px; margin-bottom: 4px;
        }
        .subscribe-title .black { color: #f1f5f9; }
        .subscribe-title .orange { color: #f59e0b; }
        .subscribe-body { font-family: 'DM Sans', sans-serif; font-size: 16px; line-height: 1.85; color: #9ca3af; margin-bottom: 8px; }
        .subscribe-body em { font-style: normal; font-weight: 700; color: #f1f5f9; }
        .subscribe-btn {
          display: block; text-decoration: none; text-align: center; align-self: flex-end;
          background: #f59e0b; color: #111827;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 24px; letter-spacing: 3px; text-transform: uppercase;
          padding: 14px 18px; width: 380px; max-width: 100%; transition: background 0.2s; margin-top: 8px;
          border-radius: 999px;
        }
        .subscribe-btn:hover { background: #d97706; }
        .subscribe-btn-dark {
          display: block; text-decoration: none; text-align: center;
          background: #1e293b; color: #9ca3af;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 24px; letter-spacing: 3px; text-transform: uppercase;
          padding: 14px 18px; width: 380px; max-width: 100%; transition: background 0.2s; margin-top: 8px;
          border-radius: 999px;
        }
        .subscribe-btn-dark:hover { background: #111827; color: #f1f5f9; }

        /* ── FEATURE LIST ── */
        .feature-item {
          display: flex; align-items: baseline; gap: 16px;
          padding: 28px 0; border-bottom: 1px solid #ddd;
        }
        .feature-item:last-child { border-bottom: none; }
        .feature-arrow { color: #f59e0b; font-family: 'Bebas Neue', sans-serif; font-size: 20px; flex-shrink: 0; }
        .feature-text {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px; font-weight: 600;
          color: #1e293b; letter-spacing: 0.5px;
          text-transform: uppercase; line-height: 1.2;
        }
        .feature-text small {
          display: block; font-family: 'DM Sans', sans-serif;
          font-size: 15px; letter-spacing: 0; color: #9ca3af;
          font-weight: 400; text-transform: none; margin-top: 10px; line-height: 1.7;
        }

        /* ── HERO WOORD-ROTATOR ── */
        .hero-word-rotator {
          display: inline-block; background: #f59e0b; color: #111827;
          padding: 2px 16px; border-radius: 6px;
        }

        /* ── HERO FOTO (diagonale uitsnede + speedlines voor snelheid) ── */
        .hero-photo-wrap { position: relative; width: 100%; max-width: 600px; }
        .hero-photo {
          width: 100%; height: auto; display: block;
          clip-path: polygon(0 0, 100% 0, 100% 88%, 85% 100%, 0 100%);
          box-shadow: 0 32px 64px rgba(0,0,0,0.45);
        }
        .speedline {
          position: absolute; right: -30px; height: 4px; background: #f59e0b;
          transform: skewY(-8deg); border-radius: 2px;
        }
        .speedline-1 { width: 90px; bottom: 38px; opacity: 0.9; }
        .speedline-2 { width: 60px; bottom: 24px; opacity: 0.6; }
        .speedline-3 { width: 36px; bottom: 12px; opacity: 0.35; }

        /* ── CHAT PREVIEW (hero) ── */
        .chat-preview {
          width: 100%; max-width: 620px; background: #111827; border-radius: 12px;
          border: 1px solid #374151; overflow: hidden; box-shadow: 0 32px 64px rgba(0,0,0,0.45);
          position: relative;
        }
        .chat-preview-chrome {
          display: flex; align-items: center; gap: 6px; padding: 14px 20px;
          background: #1e293b; border-bottom: 1px solid #374151;
        }
        .chat-preview-dot { width: 10px; height: 10px; border-radius: 50%; background: #374151; }
        .chat-preview-url {
          margin-left: 10px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: #6b7280;
        }
        .chat-row { padding: 24px 28px; display: flex; flex-direction: column; gap: 8px; }
        .chat-row-arno { background: #1f2937; }
        .chat-label {
          font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 3px;
        }
        .chat-label-user { color: #6b7280; }
        .chat-label-arno { color: #f59e0b; }
        .chat-text-user {
          font-family: 'Bebas Neue', sans-serif; font-size: clamp(19px, 2.4vw, 25px);
          line-height: 1.4; color: #f1f5f9;
        }
        .chat-text-arno {
          font-family: 'Space Mono', monospace; font-size: 15px; line-height: 1.8; color: #9ca3af;
        }
        .chat-preview-badge {
          position: absolute; bottom: -18px; right: -18px;
          background: #f59e0b; color: #111827; border-radius: 10px;
          padding: 12px 18px; box-shadow: 0 12px 28px rgba(0,0,0,0.35);
          font-family: 'Bebas Neue', sans-serif; text-align: center; line-height: 1.1;
        }
        .chat-preview-badge strong { display: block; font-size: 26px; letter-spacing: 0.5px; }
        .chat-preview-badge span { display: block; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }

        /* ── TRUST BADGES ── */
        .trust-row {
          display: flex; flex-wrap: wrap; justify-content: center; gap: 32px;
          max-width: 760px; margin: 24px auto 0; padding-top: 20px; border-top: 1px solid #374151;
        }
        .trust-item { font-family: 'DM Sans', sans-serif; font-size: 13px; color: #9ca3af; letter-spacing: 0.3px; }
        .trust-item::before { content: '✓ '; color: #f59e0b; }

        /* ── FINALE CTA ── */
        .final-cta-section { background: #111827; padding: 72px 60px; border-top: 3px solid #f59e0b; text-align: center; }
        .final-cta-heading {
          font-family: 'Bebas Neue', sans-serif; font-size: clamp(36px, 4vw, 56px);
          color: #f1f5f9; letter-spacing: 1px; margin-bottom: 24px;
        }
        .final-cta-sub { font-family: 'DM Sans', sans-serif; font-size: 14px; color: #6b7280; margin-top: 16px; }

        /* ── FEATURES (kaarten) ── */
        .features-section { background: #f1f5f9; padding: 64px 60px; border-top: 3px solid #f59e0b; }
        .features-inner { max-width: 1000px; margin: 0 auto; }
        .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px; }
        .feature-card { background: #ffffff; border: 1px solid #ddd; border-radius: 4px; padding: 24px; }
        .feature-card-num {
          font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 2px; color: #f59e0b; margin-bottom: 10px;
        }
        .feature-card-title {
          font-family: 'Barlow Condensed', sans-serif; font-size: 19px; font-weight: 600;
          color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
        }
        .feature-card-desc { font-family: 'DM Sans', sans-serif; font-size: 14px; color: #6b7280; line-height: 1.6; }

        /* ── STATS (echte cijfers over de expertise, niet over gebruiksaantallen) ── */
        .stats-section { background: #1e293b; padding: 56px 60px; border-top: 3px solid #f59e0b; }
        .stats-grid { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; text-align: center; }
        .stat-num { font-family: 'Bebas Neue', sans-serif; font-size: clamp(36px, 4vw, 52px); color: #f59e0b; letter-spacing: -1px; line-height: 1; margin-bottom: 8px; }
        .stat-label { font-family: 'DM Sans', sans-serif; font-size: 13px; color: #9ca3af; letter-spacing: 0.3px; }

        /* ── TESTIMONIALS (langzaam scrollende slider) ── */
        .testimonial-section {
          background: #f1f5f9; padding: 80px 0; border-top: 3px solid #f59e0b; overflow: hidden;
        }
        .testimonial-inner { max-width: 1100px; margin: 0 auto 48px; padding: 0 60px; }
        .testimonial-label {
          font-family: 'DM Sans', sans-serif; font-size: 13px; letter-spacing: 4px;
          text-transform: uppercase; color: #f59e0b; margin-bottom: 12px;
        }
        .testimonial-heading {
          font-family: 'Bebas Neue', sans-serif; font-size: clamp(32px, 3.5vw, 48px);
          color: #1e293b; letter-spacing: 1px;
        }
        .testimonial-track-wrap { overflow: hidden; width: 100%; }
        .testimonial-track {
          display: flex; gap: 32px; width: max-content;
          animation: testimonial-scroll 36s linear infinite;
        }
        .testimonial-track:hover { animation-play-state: paused; }
        @keyframes testimonial-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .testimonial-card { background: #ffffff; border: 1px solid #ddd; border-radius: 4px; padding: 28px; flex: 0 0 380px; }
        .testimonial-quote {
          font-family: 'DM Sans', sans-serif; font-size: 16px; line-height: 1.8; color: #1e293b; margin-bottom: 20px;
        }
        .testimonial-name {
          font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 600;
          color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .testimonial-role { font-family: 'DM Sans', sans-serif; font-size: 14px; color: #6b7280; margin-top: 2px; }

        /* ── FAQ ── */
        .faq-section {
          background: #f1f5f9; padding: 80px 60px; border-top: 3px solid #f59e0b;
        }
        .faq-inner { max-width: 900px; margin: 0 auto; }
        .faq-label {
          font-family: 'DM Sans', sans-serif; font-size: 13px; letter-spacing: 4px;
          text-transform: uppercase; color: #f59e0b; margin-bottom: 12px;
        }
        .faq-heading {
          font-family: 'Bebas Neue', sans-serif; font-size: clamp(32px, 3.5vw, 48px);
          color: #1e293b; letter-spacing: 1px; margin-bottom: 48px;
        }
        .faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px 60px; }
        .faq-item { }
        .faq-q {
          font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 600;
          color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
        }
        .faq-a {
          font-family: 'DM Sans', sans-serif; font-size: 15px; line-height: 1.8; color: #6b7280;
        }
        .faq-a a { color: #f59e0b; text-decoration: none; }

        /* ── FOOTER ── */
        footer {
          background: #0d1117; padding: 40px 60px;
          display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
          border-top: 1px solid #1f2937;
        }
        .footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #f59e0b; letter-spacing: 3px; text-decoration: none; }
        .footer-copy { font-family: 'DM Sans', sans-serif; font-size: 15px; color: #9ca3af; }
        .footer-link { font-family: 'DM Sans', sans-serif; font-size: 15px; color: #9ca3af; text-decoration: none; transition: color 0.2s; }
        .footer-link:hover { color: #f1f5f9; }

        /* ── MOBILE ── */
        @media (max-width: 768px) {
          .site-nav { padding: 12px 20px; height: auto; }
          .nav-auth { gap: 16px; }
          .nav-login-secondary { display: none; }

          .canvas-section { grid-template-columns: 1fr; }
          .canvas-left { padding: 48px 24px; border-right: none; border-bottom: 1px solid #ddd; justify-content: flex-start; }
          .canvas-quote { border-right: none; border-left: 4px solid #f59e0b; padding-right: 0; padding-left: 24px; text-align: left; }
          .canvas-right { padding: 40px 24px; }
          .canvas-link { width: 100%; }

          .subscribe-section { grid-template-columns: 1fr; }
          .subscribe-text-col { padding: 48px 24px; border-right: none; border-bottom: 1px solid #374151; justify-content: flex-start; }
          .subscribe-text-inner { text-align: left; }
          .subscribe-btn { align-self: stretch; width: 100%; }
          .subscribe-btn-dark { width: 100%; }

          footer { padding: 32px 24px; grid-template-columns: 1fr; gap: 12px; text-align: center; }

          .faq-section { padding: 48px 24px; }
          .faq-grid { grid-template-columns: 1fr; gap: 32px; }

          .testimonial-section { padding: 48px 0; }
          .testimonial-inner { padding: 0 24px; }

          .final-cta-section { padding: 48px 24px; }

          .chat-preview { max-width: 100%; }

          .features-section { padding: 48px 24px; }
          .features-grid { grid-template-columns: 1fr; }

          .stats-section { padding: 40px 24px; }
          .stats-grid { grid-template-columns: 1fr; gap: 24px; }
        }
      `}</style>

      {/* NAV */}
      <nav className="site-nav">
        <Link href="/" className="nav-logo">ARNO<span>BOT.</span></Link>
        <div className="nav-spacer" />
        <div className="nav-auth">
          {userId
            ? <Link href="/bot" className="nav-login">MIJN BOT</Link>
            : <>
                <Link href="/sign-in" className="nav-login nav-login-secondary">INLOGGEN</Link>
                <Link href="/sign-up" className="nav-cta-btn">30 DAGEN GRATIS</Link>
              </>
          }
        </div>
      </nav>

      {/* HERO */}
      <section className="subscribe-section" style={{background: '#111827', paddingTop: '80px'}}>
        <div className="subscribe-text-col" style={{padding:'40px 30px'}}>
          <div className="hero-photo-wrap">
            <img src="/arno-price.jpg" alt="Arno Diepeveen" className="hero-photo" />
            <span className="speedline speedline-1" />
            <span className="speedline speedline-2" />
            <span className="speedline speedline-3" />
          </div>
        </div>
        <div className="canvas-right" style={{background:'#1e293b', justifyContent:'center'}}>
          <div style={{maxWidth:'540px'}}>
            <p style={{fontSize:'13px', letterSpacing:'4px', textTransform:'uppercase', color:'#f59e0b', fontFamily:"'DM Sans', sans-serif", marginBottom:'16px'}}>AI-salescoach</p>
            <h2 style={{fontFamily:"'Barlow Condensed', sans-serif", fontSize:'clamp(40px, 5vw, 68px)', fontWeight:600, color:'#f1f5f9', lineHeight:1.05, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'20px'}}>
              Haal je <HeroWordRotator />.<br />Iedere maand.
            </h2>
            <p className="subscribe-body">
              Geen generieke AI. Decennia bewezen sales-expertise, 24/7 beschikbaar.
            </p>
            <a href="/sign-up" className="subscribe-btn" style={{alignSelf:'flex-start', width:'260px'}}>30 dagen gratis</a>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section">
        <div className="features-inner">
          <div className="features-grid">
            <div className="feature-card">
              <p className="feature-card-num">01</p>
              <p className="feature-card-title">Nooit meer zonder coach</p>
              <p className="feature-card-desc">24/7 beschikbaar, geen wachttijd.</p>
            </div>
            <div className="feature-card">
              <p className="feature-card-num">02</p>
              <p className="feature-card-title">Nooit een inzicht kwijt</p>
              <p className="feature-card-desc">Je hele geschiedenis, doorzoekbaar.</p>
            </div>
            <div className="feature-card">
              <p className="feature-card-num">03</p>
              <p className="feature-card-title">Je inzichten overal bij de hand</p>
              <p className="feature-card-desc">Exporteer wat je nodig hebt.</p>
            </div>
            <div className="feature-card">
              <p className="feature-card-num">04</p>
              <p className="feature-card-title">Groei volgens een plan</p>
              <p className="feature-card-desc">Trainingsschema op maat van jouw doelen.</p>
            </div>
            <div className="feature-card">
              <p className="feature-card-num">05</p>
              <p className="feature-card-title">Meer dan een chatbot</p>
              <p className="feature-card-desc">40 jaar expertise als bron: blogs, boeken, video's.</p>
            </div>
            <div className="feature-card">
              <p className="feature-card-num">06</p>
              <p className="feature-card-title">Arno zelf binnen bereik</p>
              <p className="feature-card-desc">Als de bot niet ver genoeg gaat. *</p>
            </div>
          </div>
          <div style={{textAlign:'center'}}>
            <a href="/sign-up" style={{
              display:'inline-block', textDecoration:'none', textAlign:'center',
              background:'#f59e0b', color:'#1e293b', fontFamily:"'Bebas Neue', sans-serif",
              fontSize:'20px', letterSpacing:'3px', padding:'12px 0', width:'150px', borderRadius:'999px'
            }}>START NU.</a>
          </div>
        </div>
      </section>

      {/* HOE HET WERKT */}
      <section className="canvas-section">
        <div className="canvas-left">
          <div className="canvas-left-inner">
            <div className="canvas-quote" style={{marginBottom:'32px'}}>
              Overperformance.<br />
              <em>Iedere maand.</em>
            </div>
            <div className="chat-preview" style={{maxWidth:'100%'}}>
              <div className="chat-preview-chrome">
                <span className="chat-preview-dot" />
                <span className="chat-preview-dot" />
                <span className="chat-preview-dot" />
                <span className="chat-preview-url">arno.bot/bot</span>
              </div>
              <div className="chat-row">
                <span className="chat-label chat-label-user">JIJ</span>
                <p className="chat-text-user">Ik verlies steeds dezelfde deal aan dezelfde concurrent.</p>
              </div>
              <div className="chat-row chat-row-arno">
                <span className="chat-label chat-label-arno">ARNO</span>
                <p className="chat-text-arno">Dan verlies je 'm niet in het gesprek. Je verliest 'm ervoor. Wat weet jij van hun business dat niemand anders vertelt?</p>
              </div>
            </div>
          </div>
        </div>
        <div className="canvas-right">
          <div style={{maxWidth:'540px', width:'100%'}}>
            <div className="feature-item" style={{paddingTop:'0'}}>
              <span className="feature-arrow">1</span>
              <span className="feature-text">Vertel je situatie<small>Markt, product, targets. Klaar in twee minuten.</small></span>
            </div>
            <div className="feature-item">
              <span className="feature-arrow">2</span>
              <span className="feature-text">Stel je scherpste vraag<small>Een dode deal, een lastige klant, een team dat vastzit.</small></span>
            </div>
            <div className="feature-item">
              <span className="feature-arrow">3</span>
              <span className="feature-text">Krijg een concreet antwoord<small>Geen algemeenheden, een directe en bruikbare volgende stap.</small></span>
            </div>
            <div className="feature-item">
              <span className="feature-arrow">4</span>
              <span className="feature-text">Bouw je salesarchief op<small>Elk gesprek blijft bewaard, altijd terug te vinden.</small></span>
            </div>
            <div className="feature-item" style={{borderBottom:'none'}}>
              <span className="feature-arrow">5</span>
              <span className="feature-text">Word met elk gesprek scherper gekend<small>Patronen, blinde vlekken, kansen: ArnoBot ziet ze steeds beter.</small></span>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS — vaste aanbevelingen over Arno's expertise, plus toekomstige productreviews uit Sanity. Traag scrollende slider, dubbele set voor een naadloze loop. */}
      <section className="testimonial-section">
        <div className="testimonial-inner">
          <p className="testimonial-label">Wat mensen over Arno zeggen</p>
          <h2 className="testimonial-heading">Geen loze beloftes</h2>
        </div>
        <div className="testimonial-track-wrap">
          <div className="testimonial-track">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div className="testimonial-card" key={`${t._id}-${i}`}>
                <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                <p className="testimonial-name">{t.name}</p>
                {t.role && <p className="testimonial-role">{t.role}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS — over de expertise en kennisbank, niet over het (nog kleine) gebruikersaantal */}
      <section className="stats-section">
        <div className="stats-grid">
          <div>
            <p className="stat-num">42</p>
            <p className="stat-label">Sales expertise</p>
          </div>
          <div>
            <p className="stat-num">369.000+</p>
            <p className="stat-label">Woorden</p>
          </div>
          <div>
            <p className="stat-num">500+</p>
            <p className="stat-label">Blog posts</p>
          </div>
        </div>
      </section>

      {/* PRICING — bewust compact, geen dominante sectie */}
      <section style={{background:'#1e293b', padding:'48px 60px', borderTop:'3px solid #f59e0b'}}>
        <div style={{maxWidth:'760px', margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
          <div style={{background:'#111827', border:'1px solid #374151', borderRadius:'4px', padding:'24px', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', textAlign:'center'}}>
            <span style={{fontSize:'14px', letterSpacing:'3px', textTransform:'uppercase', color:'#f59e0b', fontFamily:"'Bebas Neue', sans-serif"}}>Per maand</span>
            <div style={{display:'flex', alignItems:'baseline', gap:'4px'}}>
              <span style={{fontFamily:"'Bebas Neue', sans-serif", fontSize:'20px', color:'#6b7280'}}>€</span>
              <span style={{fontFamily:"'Bebas Neue', sans-serif", fontSize:'clamp(32px, 3vw, 44px)', color:'#f1f5f9', letterSpacing:'-1px', lineHeight:0.9}}>77</span>
            </div>
            <a href="/sign-up" style={{
              display:'inline-block', textDecoration:'none', textAlign:'center',
              background:'#f59e0b', color:'#1e293b', fontFamily:"'Bebas Neue', sans-serif",
              fontSize:'15px', letterSpacing:'2px', padding:'8px 0', width:'110px', borderRadius:'999px',
              transition:'background 0.2s'
            }}>START NU.</a>
            <span style={{fontSize:'12px', color:'#6b7280', fontFamily:"'DM Sans', sans-serif", letterSpacing:'0.5px'}}>30 dagen gratis</span>
          </div>
          <div style={{background:'#111827', border:'1px solid #374151', borderRadius:'4px', padding:'24px', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', textAlign:'center'}}>
            <span style={{fontSize:'14px', letterSpacing:'3px', textTransform:'uppercase', color:'#f59e0b', fontFamily:"'Bebas Neue', sans-serif"}}>Per jaar <span style={{color:'#6b7280', textTransform:'none', letterSpacing:0}}>(3 mnd gratis)</span></span>
            <div style={{display:'flex', alignItems:'baseline', gap:'4px'}}>
              <span style={{fontFamily:"'Bebas Neue', sans-serif", fontSize:'20px', color:'#6b7280'}}>€</span>
              <span style={{fontFamily:"'Bebas Neue', sans-serif", fontSize:'clamp(32px, 3vw, 44px)', color:'#f1f5f9', letterSpacing:'-1px', lineHeight:0.9}}>697</span>
            </div>
            <a href="/sign-up" style={{
              display:'inline-block', textDecoration:'none', textAlign:'center',
              background:'#f59e0b', color:'#1e293b', fontFamily:"'Bebas Neue', sans-serif",
              fontSize:'15px', letterSpacing:'2px', padding:'8px 0', width:'110px', borderRadius:'999px',
              transition:'background 0.2s'
            }}>START NU.</a>
            <span style={{fontSize:'12px', color:'#6b7280', fontFamily:"'DM Sans', sans-serif", letterSpacing:'0.5px'}}>30 dagen gratis</span>
          </div>
        </div>
        <div style={{maxWidth:'760px', margin:'20px auto 0', borderTop:'1px solid #374151', paddingTop:'20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px', textAlign:'center'}}>
          <span style={{fontFamily:"'DM Sans', sans-serif", fontSize:'13px', color:'#9ca3af', letterSpacing:'0.5px'}}>
            Wil je je hele salesteam uitrusten met ArnoBot als persoonlijke coach?
          </span>
          <a href="mailto:arno@arno.bot" style={{
            fontFamily:"'Bebas Neue', sans-serif", fontSize:'16px', letterSpacing:'3px',
            color:'#f59e0b', textDecoration:'none', textTransform:'uppercase', whiteSpace:'nowrap'
          }}>Neem contact op →</a>
        </div>
        <div className="trust-row">
          <span className="trust-item">Privé & versleuteld opgeslagen</span>
          <span className="trust-item">Nooit gedeeld met derden</span>
          <span className="trust-item">Maandelijks opzegbaar</span>
        </div>
      </section>

      {/* ARNOLIVE */}
      <section className="final-cta-section" style={{textAlign:'center', paddingBottom:'56px'}}>
        <p className="testimonial-label" style={{textAlign:'center'}}>Binnenkort</p>
        <h2 className="final-cta-heading" style={{marginBottom:'16px'}}>ARNO<span style={{color:'#f59e0b'}}>LIVE.</span></h2>
        <p style={{fontFamily:"'DM Sans', sans-serif", fontSize:'16px', color:'#9ca3af', maxWidth:'480px', margin:'0 auto'}}>
          Persoonlijke coaching met Arno zelf. Voor als de bot niet ver genoeg gaat.
        </p>
        <p style={{fontFamily:"'DM Sans', sans-serif", fontSize:'12px', color:'#6b7280', letterSpacing:'0.5px', marginTop:'12px'}}>* Een half uur per kwartaal gratis bij een jaarabonnement.</p>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="faq-inner">
          <p className="faq-label">Veelgestelde vragen</p>
          <h2 className="faq-heading">Nog twijfels?</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <p className="faq-q">Voor wie is ArnoBot?</p>
              <p className="faq-a">Voor salesprofessionals, accountmanagers en salesmanagers die dagelijks met klanten en targets werken, van zelfstandig ondernemer tot corporate team.</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Is dit een chatbot met standaardantwoorden?</p>
              <p className="faq-a">Nee. ArnoBot kent jouw markt, product en targets, en bouwt met elk gesprek een archief op van jouw specifieke situatie. Geen generiek advies.</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Kan ik elk moment opzeggen?</p>
              <p className="faq-a">Ja, maandelijks opzegbaar, geen verborgen voorwaarden.</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Is mijn data veilig?</p>
              <p className="faq-a">Ja, gesprekken zijn privé en versleuteld opgeslagen, nooit gedeeld met derden. Lees het na in ons <a href="/privacy">privacybeleid</a>.</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Wat kost het na de proefperiode?</p>
              <p className="faq-a">€77 per maand of €697 per jaar, dat zijn 3 maanden gratis. Transparant, geen addertjes.</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Werkt dit ook voor een heel salesteam?</p>
              <p className="faq-a">Ja, neem <a href="mailto:arno@arno.bot">contact op</a> voor teamlicenties.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FINALE CTA */}
      <section className="final-cta-section">
        <h2 className="final-cta-heading">Klaar om te scoren?</h2>
        <a href="/sign-up" className="subscribe-btn" style={{margin:'0 auto', width:'280px'}}>30 dagen gratis</a>
        <p className="final-cta-sub">Geen creditcard nodig. Geen verplichtingen.</p>
      </section>

      {/* FOOTER */}
      <footer>
        <Link href="/" className="footer-logo">ARNOBOT.</Link>
        <span style={{ display: 'flex', gap: 24 }}>
          <Link href="/voorwaarden" className="footer-link">VOORWAARDEN</Link>
          <Link href="/privacy" className="footer-link">PRIVACY</Link>
        </span>
        <span className="footer-copy" style={{ textAlign: 'right' }}>© 2026 ArnoBot</span>
      </footer>
    </>
  )
}
