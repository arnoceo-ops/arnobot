import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { client } from '@/sanity/client'

type Testimonial = { _id: string; quote: string; name: string; role?: string }

async function getTestimonials(): Promise<Testimonial[]> {
  return await client.fetch(`*[_type == "testimonial"] | order(_createdAt desc)`, {}, { next: { revalidate: 0 } })
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

        /* ── DIFFERENTIATIE (waarom geen ChatGPT) ── */
        .diff-section { background: #111827; padding: 64px 60px; border-top: 3px solid #f59e0b; }
        .diff-inner { max-width: 900px; margin: 0 auto; text-align: center; }
        .diff-label {
          font-family: 'DM Sans', sans-serif; font-size: 13px; letter-spacing: 4px;
          text-transform: uppercase; color: #f59e0b; margin-bottom: 12px;
        }
        .diff-heading {
          font-family: 'Bebas Neue', sans-serif; font-size: clamp(32px, 3.5vw, 48px);
          color: #f1f5f9; letter-spacing: 1px; margin-bottom: 40px;
        }
        .diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #374151; border-radius: 4px; overflow: hidden; text-align: left; }
        .diff-col { padding: 28px; }
        .diff-col-generic { background: #1e293b; border-right: 1px solid #374151; }
        .diff-col-arno { background: #1f2937; }
        .diff-col-title {
          font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px;
          text-transform: uppercase; margin-bottom: 20px;
        }
        .diff-col-generic .diff-col-title { color: #6b7280; }
        .diff-col-arno .diff-col-title { color: #f59e0b; }
        .diff-point { font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.7; color: #9ca3af; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .diff-point:last-child { border-bottom: none; }
        .diff-col-arno .diff-point { color: #f1f5f9; }

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

        /* ── TESTIMONIALS ── */
        .testimonial-section {
          background: #f1f5f9; padding: 80px 60px; border-top: 3px solid #f59e0b;
        }
        .testimonial-inner { max-width: 1100px; margin: 0 auto; }
        .testimonial-label {
          font-family: 'DM Sans', sans-serif; font-size: 13px; letter-spacing: 4px;
          text-transform: uppercase; color: #f59e0b; margin-bottom: 12px;
        }
        .testimonial-heading {
          font-family: 'Bebas Neue', sans-serif; font-size: clamp(32px, 3.5vw, 48px);
          color: #1e293b; letter-spacing: 1px; margin-bottom: 48px;
        }
        .testimonial-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px; }
        .testimonial-card { background: #ffffff; border: 1px solid #ddd; border-radius: 4px; padding: 28px; }
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

          .testimonial-section { padding: 48px 24px; }

          .diff-section { padding: 48px 24px; }
          .diff-grid { grid-template-columns: 1fr; }
          .diff-col-generic { border-right: none; border-bottom: 1px solid #374151; }

          .authority-section { padding: 40px 24px; }

          .final-cta-section { padding: 48px 24px; }

          .chat-preview { max-width: 100%; }
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
            <img src="/arno-home1.jpg" alt="Arno Diepeveen" className="hero-photo" />
            <span className="speedline speedline-1" />
            <span className="speedline speedline-2" />
            <span className="speedline speedline-3" />
          </div>
        </div>
        <div className="canvas-right" style={{background:'#1e293b', justifyContent:'center'}}>
          <div style={{maxWidth:'540px'}}>
            <p style={{fontSize:'13px', letterSpacing:'4px', textTransform:'uppercase', color:'#f59e0b', fontFamily:"'DM Sans', sans-serif", marginBottom:'16px'}}>AI-salescoach</p>
            <h2 style={{fontFamily:"'Barlow Condensed', sans-serif", fontSize:'clamp(40px, 5vw, 68px)', fontWeight:600, color:'#f1f5f9', lineHeight:1.05, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'20px'}}>
              <span style={{color:'#f59e0b'}}>Overperformance.</span><br />Iedere maand.
            </h2>
            <p className="subscribe-body">
              Geen generieke AI. Decennia bewezen sales-expertise, 24/7 beschikbaar.
            </p>
            <a href="/sign-up" className="subscribe-btn" style={{alignSelf:'flex-start', width:'260px'}}>30 dagen gratis</a>
          </div>
        </div>
      </section>

      {/* HOE HET WERKT */}
      <section className="canvas-section">
        <div className="canvas-left">
          <div className="canvas-left-inner">
            <div className="canvas-quote">
              Jij bent de sales pro.<br />
              Wij zijn je turbo.<br />
              Scoren in<br />
              <em>overdrive.</em>
            </div>
          </div>
        </div>
        <div className="canvas-right">
          <div style={{maxWidth:'540px', width:'100%'}}>
            <div className="feature-item" style={{paddingTop:'0'}}>
              <span className="feature-arrow">1</span>
              <span className="feature-text">Deel je situatie<small>Markt, product, targets. ArnoBot snapt het meteen.</small></span>
            </div>
            <div className="feature-item">
              <span className="feature-arrow">2</span>
              <span className="feature-text">Bouw je salesarchief op<small>Elk gesprek blijft bewaard. Hoe meer, hoe scherper.</small></span>
            </div>
            <div className="feature-item" style={{borderBottom:'none'}}>
              <span className="feature-arrow">3</span>
              <span className="feature-text">Krijg steeds scherper advies<small>Persoonlijker en raker met elk gesprek.</small></span>
            </div>
          </div>
        </div>
      </section>

      {/* WAAROM GEEN CHATGPT */}
      <section className="diff-section">
        <div className="diff-inner">
          <p className="diff-label">Het verschil</p>
          <h2 className="diff-heading">Waarom niet gewoon ChatGPT?</h2>
          <div className="diff-grid">
            <div className="diff-col diff-col-generic">
              <p className="diff-col-title">Generieke AI</p>
              <p className="diff-point">Vergeet elk gesprek</p>
              <p className="diff-point">Advies voor iedereen, dus voor niemand</p>
            </div>
            <div className="diff-col diff-col-arno">
              <p className="diff-col-title">ArnoBot</p>
              <p className="diff-point">Onthoudt je hele geschiedenis</p>
              <p className="diff-point">Advies op maat van jouw markt</p>
            </div>
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
        <p style={{maxWidth:'760px', margin:'16px auto 0', textAlign:'center', fontFamily:"'DM Sans', sans-serif", fontSize:'13px', color:'#6b7280', letterSpacing:'0.3px'}}>
          Dat is minder dan een kwartier consultancy. Voor een hele maand 24/7 coaching.
        </p>
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

      {/* TESTIMONIALS — alleen tonen zodra er echte testimonials in Sanity staan */}
      {testimonials.length > 0 && (
        <section className="testimonial-section">
          <div className="testimonial-inner">
            <p className="testimonial-label">Wat gebruikers zeggen</p>
            <h2 className="testimonial-heading">Geen loze beloftes</h2>
            <div className="testimonial-grid">
              {testimonials.map(t => (
                <div className="testimonial-card" key={t._id}>
                  <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                  <p className="testimonial-name">{t.name}</p>
                  {t.role && <p className="testimonial-role">{t.role}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FEATURES */}
      <section className="canvas-section">
        <div className="canvas-left">
          <div className="canvas-left-inner">
            <div className="feature-item" style={{flexDirection:'row-reverse'}}>
              <span className="feature-arrow">←</span>
              <span className="feature-text" style={{textAlign:'right'}}>Unlimited sales coaching<small>24/7. Geen limiet.</small></span>
            </div>
            <div className="feature-item" style={{flexDirection:'row-reverse'}}>
              <span className="feature-arrow">←</span>
              <span className="feature-text" style={{textAlign:'right'}}>Jouw sales archief<small>Doorzoekbaar, altijd beschikbaar.</small></span>
            </div>
            <div className="feature-item" style={{flexDirection:'row-reverse'}}>
              <span className="feature-arrow">←</span>
              <span className="feature-text" style={{textAlign:'right'}}>PDF Export<small>Exporteer wat je wilt.</small></span>
            </div>
          </div>
        </div>
        <div className="canvas-right">
          <div style={{maxWidth:'540px', width:'100%'}}>
            <div className="feature-item">
              <span className="feature-arrow">→</span>
              <span className="feature-text">Personal Training<small>Trainingsschema op maat.</small></span>
            </div>
            <div className="feature-item">
              <span className="feature-arrow">→</span>
              <span className="feature-text">Verdiep je expertise<small>Blogs, boeken, video's.</small></span>
            </div>
            <div className="feature-item" style={{borderBottom:'none'}}>
              <span className="feature-arrow">→</span>
              <span className="feature-text">1:1 met de oprichter<small>Overleg met Arno zelf. *</small></span>
            </div>
            <div style={{paddingTop:'28px'}}>
              <a href="/sign-up" style={{
                display:'inline-block', textDecoration:'none', textAlign:'center',
                background:'#f59e0b', color:'#1e293b', fontFamily:"'Bebas Neue', sans-serif",
                fontSize:'20px', letterSpacing:'3px', padding:'12px 0', width:'150px', borderRadius:'999px'
              }}>START NU.</a>
            </div>
          </div>
        </div>
      </section>

      {/* COMING SOON */}
      <section className="canvas-section" style={{background:'#111827', borderTop:'3px solid #f59e0b'}}>
        <div className="canvas-left" style={{borderRight:'1px solid #374151'}}>
          <div className="canvas-left-inner" style={{display:'flex', justifyContent:'flex-end'}}>
            <div style={{fontFamily:"'Bebas Neue', sans-serif", fontSize:'14px', letterSpacing:'6px', color:'#6b7280', border:'2px dashed #374151', padding:'8px 20px', display:'inline-block'}}>
              BINNENKORT
            </div>
          </div>
        </div>
        <div className="canvas-right" style={{background:'#1e293b'}}>
          <div style={{maxWidth:'540px', width:'100%'}}>
            <h2 className="canvas-title" style={{color:'#f1f5f9'}}>ARNO<span style={{color:'#f59e0b'}}>LIVE.</span></h2>
            <p className="canvas-body" style={{color:'#9ca3af'}}>
              Persoonlijke coaching met Arno zelf. Voor als de bot niet ver genoeg gaat.
            </p>
            <p style={{fontFamily:"'DM Sans', sans-serif", fontSize:'12px', color:'#6b7280', letterSpacing:'0.5px', marginTop:'8px'}}>* Een half uur per kwartaal gratis bij een jaarabonnement.</p>
          </div>
        </div>
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
