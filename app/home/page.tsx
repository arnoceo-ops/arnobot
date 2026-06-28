import { client } from '@/sanity/client'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

interface Post {
  _id: string
  title: string
  slug: { current: string }
  publishedAt: string
}

function decodeHtml(str: string): string {
  return (str || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

async function getPosts(): Promise<Post[]> {
  const posts = await client.fetch(`*[_type == "post"] | order(publishedAt desc) { _id, title, slug, publishedAt }`)
  const seen = new Set<string>()
  return posts.filter((p: Post) => {
    const key = decodeHtml(p.title || '').toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/')

  const { userId } = await auth()
  if (userId) redirect('/bot')
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@300;600;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }

        /* ── NAV ── */
        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 40px; height: 60px; display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-spacer { flex: 1; }
        .nav-links { display: flex; gap: 48px; align-items: center; }
        .nav-links a {
          color: #9ca3af; text-decoration: none;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 3px; transition: color 0.2s;
        }
        .nav-links a:hover { color: #f1f5f9; }
        .nav-cta { color: #f59e0b !important; }
        .nav-btn {
          color: #9ca3af; text-decoration: none;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 3px; transition: color 0.2s;
        }
        .nav-btn:hover { color: #f1f5f9; }
        .nav-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .nav-sub {
          font-family: 'Space Mono', monospace; font-size: 9px;
          letter-spacing: 2px; color: #4b5563; text-decoration: none;
          text-transform: uppercase; transition: color 0.2s;
        }
        .nav-sub:hover { color: #f59e0b !important; }

        /* ── HERO ── */
        .hero {
          position: relative; width: 100%; height: 100vh;
          min-height: 600px; overflow: hidden; display: flex; align-items: flex-end;
        }
        .hero-bg {
          position: absolute; inset: 0;
          background-image: url('/hero.jpg');
          background-size: cover; background-position: center; background-color: #1e293b;
        }
        .hero-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(105deg, rgba(17,24,39,0.92) 0%, rgba(17,24,39,0.6) 45%, rgba(17,24,39,0.15) 100%);
        }
        .hero-content { position: relative; z-index: 2; padding: 0 0 80px 60px; }
        .hero-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(80px, 12vw, 160px);
          line-height: 0.88; letter-spacing: -2px; color: #f1f5f9;
        }
        .hero-title span { color: #f59e0b; }
        .hero-tagline {
          position: absolute; bottom: 80px; right: 60px; z-index: 2;
          text-align: right; display: none;
        }
        .hero-tagline p {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(28px, 3vw, 44px);
          letter-spacing: 4px; text-transform: uppercase;
          color: rgba(241,245,249,0.6); line-height: 1.4;
        }
        .hero-tagline p span { color: rgba(245,158,11,0.9); }
        @media (min-width: 768px) { .hero-tagline { display: block; } }

        /* ── CANVAS ── */
        .canvas-section {
          background: #f1f5f9; display: grid; grid-template-columns: 1fr 1fr;
          border-top: 3px solid #f59e0b;
        }
        .canvas-left {
          padding: 80px 60px; border-right: 1px solid #ddd; display: flex;
          align-items: flex-start; justify-content: flex-end;
        }
        .canvas-left-inner { max-width: 480px; width: 100%; }
        .canvas-quote {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(40px, 4vw, 64px);
          line-height: 1.05; color: #111827;
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
          line-height: 1.05; color: #111827; letter-spacing: 1px;
        }
        .canvas-body { font-size: 15px; line-height: 2; color: #6b7280; max-width: 420px; }
        .canvas-link {
          display: block; color: #f59e0b; text-decoration: none;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 24px; letter-spacing: 3px; text-transform: uppercase;
          margin-top: 16px; background: #111827;
          padding: 14px 18px; border: none; border-radius: 999px;
          width: 380px; max-width: 100%; text-align: center; transition: background 0.2s;
        }
        .canvas-link:hover { background: #1e293b; }

        /* ── SUBSCRIBE ── */
        .subscribe-section {
          background: #1f2937; color: #f1f5f9;
          display: grid; grid-template-columns: 1fr 1fr;
          border-top: 3px solid #f59e0b;
        }
        .subscribe-text-col {
          padding: 80px 60px; border-right: 1px solid #374151;
          display: flex; align-items: flex-start; justify-content: flex-end;
        }
        .subscribe-text-inner { max-width: 480px; width: 100%; display: flex; flex-direction: column; gap: 16px; text-align: right; }
        .subscribe-photo-col { }
        .subscribe-photo-col img { display: block; width: calc(100% - 120px); height: auto; margin: 80px 60px; }
        .subscribe-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(40px, 4vw, 64px);
          line-height: 1.05; letter-spacing: 1px; margin-bottom: 4px;
        }
        .subscribe-title .black { color: #f1f5f9; }
        .subscribe-title .orange { color: #f59e0b; }
        .subscribe-body { font-size: 15px; line-height: 2; color: #9ca3af; margin-bottom: 8px; }
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

        /* ── FOOTER ── */
        footer {
          background: #f1f5f9; color: #111827; padding: 60px;
          display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px;
          border-top: 3px solid #f59e0b; align-items: flex-start;
        }
        .footer-logo {
          font-family: 'Bebas Neue', sans-serif; font-size: 40px;
          color: #f59e0b; letter-spacing: 3px; display: block; margin-bottom: 12px; margin-top: -7px;
        }
        .footer-quote { font-size: 15px; color: #9ca3af; line-height: 2; max-width: 520px; font-family: 'Space Mono', monospace; }
        .footer-quote .attribution { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 3px; color: #f59e0b; display: block; margin-top: 6px; }
        .social-icons { display: flex; gap: 20px; margin-top: 24px; }
        .social-icons a { text-decoration: none; transition: opacity 0.2s; }
        .social-icons a:hover { opacity: 0.75; }
        .social-icons svg { width: 24px; height: 24px; fill: currentColor; }
        .icon-email { color: #9ca3af; }
        .icon-telegram { color: #2AABEE; }
        .icon-instagram { color: #E1306C; }
        .icon-linkedin { color: #0A66C2; }
        .footer-col h4 {
          font-size: 15px; letter-spacing: 3px; text-transform: uppercase;
          color: #111827; margin-bottom: 20px; font-family: 'Space Mono', monospace; font-weight: 700;
        }
        .footer-links { list-style: none; }
        .footer-links li { margin-bottom: 10px; }
        .footer-links a { color: #9ca3af; text-decoration: none; font-size: 15px; font-family: 'Space Mono', monospace; transition: color 0.1s; }
        .footer-links a:hover { color: #f59e0b; }
        .footer-bottom {
          grid-column: span 3; border-top: 1px solid #ddd; padding-top: 32px;
          display: flex; justify-content: space-between; color: #6b7280; font-size: 10px;
        }

        /* ── MOBILE ── */
        @media (max-width: 768px) {
          .site-nav { padding: 12px 20px; }
          .nav-links { gap: 20px; }
          .nav-links a { font-size: 17px; letter-spacing: 2px; }

          .hero-content { padding: 0 0 48px 24px; }

          .canvas-section { grid-template-columns: 1fr; }
          .canvas-left { padding: 48px 24px; border-right: none; border-bottom: 1px solid #ddd; justify-content: flex-start; }
          .canvas-quote { border-right: none; border-left: 4px solid #f59e0b; padding-right: 0; padding-left: 24px; text-align: left; }
          .canvas-right { padding: 40px 24px; }
          .canvas-link { width: 100%; }

          .subscribe-section { grid-template-columns: 1fr; }
          .subscribe-text-col { padding: 48px 24px; border-right: none; border-bottom: 1px solid #374151; justify-content: flex-start; }
          .subscribe-text-inner { text-align: left; }
          .subscribe-btn { align-self: stretch; width: 100%; }
          .subscribe-photo-col img { width: calc(100% - 48px); margin: 40px 24px; }

          footer { grid-template-columns: 1fr; padding: 40px 24px; gap: 32px; }
          .footer-bottom { grid-column: span 1; flex-direction: column; gap: 8px; }
        }
      `}</style>

      {/* NAV — homepage: geen HOME */}
      <nav className="site-nav">
        <div className="nav-spacer" />
        <div className="nav-links">
          <Link href="/bio">ARNO</Link>
          <a href="/arnobot">BOT</a>
          <a href="https://salescanvas.app" target="_blank" rel="noopener noreferrer">CANVAS</a>
          <a href="https://arno.blog/subscribe" target="_blank" rel="noopener noreferrer" className="nav-cta">SUBSCRIBE</a>
        </div>
        <div className="nav-spacer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '32px' }}>
          {userId
            ? <Link href="/bot" className="nav-btn">MIJN BOT</Link>
            : <>
                <Link href="/sign-up" className="nav-btn">AANMELDEN</Link>
                <Link href="/sign-in" className="nav-btn">INLOGGEN</Link>
              </>
          }
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-tagline">
          <p>Provocerend. Suggestief.</p>
          <p>Ongefilterd. <span>Priceless.</span></p>
        </div>
        <div className="hero-content">
          <h1 className="hero-title">ROYAL<br />DUTCH<br /><span>SALES.</span></h1>
        </div>
      </section>

      {/* SALESCANVAS */}
      <section className="canvas-section">
        <div className="canvas-left">
          <div className="canvas-left-inner">
            <div className="canvas-quote">
              "Vision without action<br />
              is a <em>daydream.</em><br />
              Action without vision<br />
              is a <em>nightmare.</em>"
            </div>
          </div>
        </div>
        <div className="canvas-right">
          <h2 className="canvas-title">SALES<span style={{color:'#f59e0b'}}>CANVAS.</span></h2>
          <p className="canvas-body">
            De meeste bazen weten niet waarom ze winnen. En al helemaal niet waarom ze verliezen. Sales Canvas legt het bloot. Geen excuses, geen flaterende spiegel. Goed verkopen is geen talent; het is een systeem. Brutaal eerlijk, zonder ruimte voor zelfbedrog. Bewijst zichzelf in 30 dagen gratis.
          </p>
          <a href="https://salescanvas.app" target="_blank" rel="noopener noreferrer" className="canvas-link">GO GO CANVAS →</a>
        </div>
      </section>

      {/* ARNOBOT */}
      <section className="subscribe-section" style={{background: '#111827'}}>
        <div className="subscribe-text-col">
          <div className="subscribe-text-inner">
            <h2 className="subscribe-title">
              <span className="black">ARNO</span><span className="orange">BOT.</span>
            </h2>
            <p className="subscribe-body">
              19 jaar blogs. 369.000 woorden. Alles over sales, strategie en mindset. Nu beschikbaar als directe gesprekspartner. Geen chatbot-gedoe, geen corporate taal. Gewoon Arno, ongefilterd en zonder omwegen.
            </p>
            <a href="https://arno.blog/bot" target="_blank" rel="noopener noreferrer" className="subscribe-btn">STEL JE VRAAG →</a>
          </div>
        </div>
        <div className="canvas-right">
          <a href="https://arno.blog/bot" target="_blank" rel="noopener noreferrer">
            <img src="/cyborg.jpg" alt="ArnoBot" style={{display: 'block', width: '380px', maxWidth: '100%', height: 'auto'}} />
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div>
          <span className="footer-logo">Royal Dutch Sales</span>
          <p className="footer-quote">
            <span style={{display:'block'}}>"We are what we repeatedly do.</span>
            <span style={{display:'block'}}>Excellence, then, is not an act but a habit."</span>
            <span className="attribution">~ Aristotle</span>
            <span style={{display:'block', marginTop:'16px'}}>"Unfortunately, so is failure."</span>
            <span className="attribution">~ Vince Lombardi</span>
          </p>
        </div>
        <div className="footer-col">
          <h4>Navigatie</h4>
          <ul className="footer-links">
            <li><Link href="/bio">Arno</Link></li>
            <li><a href="/arnobot">Bot</a></li>
            <li><a href="https://salescanvas.app" target="_blank" rel="noopener noreferrer">Canvas</a></li>
            <li><a href="https://arno.blog/subscribe">Subscribe</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Contact</h4>
          <div className="social-icons">
            <a href="mailto:rds@arno.8shield.net" title="Email" className="icon-email">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
            </a>
            <a href="https://t.me/arnodiepeveen" title="Telegram" className="icon-telegram">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>
            <a href="https://www.instagram.com/royaldutchsales" title="Instagram" className="icon-instagram">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
            </a>
            <a href="https://linkedin.com/in/arnodiepeveen" title="LinkedIn" className="icon-linkedin">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© Royal Dutch Sales · Since 2007</span>
          <span>CC BY-ND 4.0</span>
        </div>
      </footer>
    </>
  )
}
