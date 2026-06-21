import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'ArnoBot: Jouw Personal Sales Coach',
  description: 'ArnoBot: 20 jaar sales expertise, 24/7 beschikbaar als jouw persoonlijke coach.',
  robots: { index: true, follow: true },
}

export default async function ArnoBotLandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/bot')
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@300;600;900&family=DM+Sans:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #1e293b; color: #f1f5f9; font-family: 'Space Mono', monospace; }

        /* ── NAV ── */
        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 40px; height: 60px; display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-spacer { flex: 1; }
        .nav-auth {
          display: flex; gap: 32px; align-items: center;
        }
        .nav-login {
          font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px;
          color: #9ca3af; text-decoration: none; transition: color 0.2s;
        }
        .nav-login:hover { color: #f1f5f9; }

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

        /* ── FOOTER ── */
        footer {
          background: #0d1117; padding: 40px 60px;
          display: flex; justify-content: space-between; align-items: center;
          border-top: 1px solid #1f2937;
        }
        .footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #f59e0b; letter-spacing: 3px; text-decoration: none; }
        .footer-copy { font-size: 10px; color: #374151; }

        /* ── MOBILE ── */
        @media (max-width: 768px) {
          .site-nav { padding: 12px 20px; }

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

          footer { padding: 32px 24px; flex-direction: column; gap: 12px; text-align: center; }
        }
      `}</style>

      {/* NAV — alleen auth */}
      <nav className="site-nav">
        <div className="nav-spacer" />
        <div className="nav-auth">
          {userId
            ? <Link href="/bot" className="nav-login">MIJN BOT</Link>
            : <>
                <Link href="/sign-up" className="nav-login">AANMELDEN</Link>
                <Link href="/sign-in" className="nav-login">INLOGGEN</Link>
              </>
          }
        </div>
      </nav>

      {/* INTRO */}
      <section className="subscribe-section" style={{background: '#111827', paddingTop: '80px'}}>
        <div className="subscribe-text-col">
          <img src="/cyborg.jpg" alt="ArnoBot" style={{display:'block', width:'380px', maxWidth:'100%', height:'auto'}} />
        </div>
        <div className="canvas-right" style={{background:'#1e293b', justifyContent:'center'}}>
          <div style={{maxWidth:'540px'}}>
            <p style={{fontSize:'13px', letterSpacing:'4px', textTransform:'uppercase', color:'#f59e0b', fontFamily:"'Space Mono', monospace", marginBottom:'16px'}}>ArnoBot Unlimited</p>
            <h2 style={{fontFamily:"'Barlow Condensed', sans-serif", fontSize:'clamp(32px, 3.5vw, 52px)', fontWeight:600, color:'#f1f5f9', lineHeight:1.1, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'20px'}}>
              Jouw Personal Sales<br />Coach <span style={{color:'#f59e0b'}}>voor €97 p/m</span>
            </h2>
            <p className="subscribe-body">
              Dat is het equivalent van een kwartier consultancy. Wat jij hiervoor krijgt, is 24/7 toegang tot Arno's brein: 40 jaar sales leadership, 30 jaar bedrijven bouwen en 20 jaar sales blogs schrijven.<br /><br />Wat het je oplevert? Verkopen vanuit je unieke kracht. Sales mastery. Crushing targets. It's your call.
            </p>
          </div>
        </div>
      </section>

      {/* PERSOONLIJK PROFIEL */}
      <section className="canvas-section">
        <div className="canvas-left">
          <div className="canvas-left-inner">
            <div className="canvas-quote">
              Jij bent de Man M/V.<br />
              Wij de machine.<br />
              Samen zijn we<br />
              <em>onoverwinnelijk.</em>
            </div>
          </div>
        </div>
        <div className="canvas-right">
          <div style={{maxWidth:'540px', width:'100%'}}>
            <div className="feature-item" style={{paddingTop:'0'}}>
              <span className="feature-arrow">→</span>
              <span className="feature-text">Met jouw profiel als uitgangspunt<small>Je geeft aan in welke markt je actief bent, wat je verkoopt, wat je targets zijn en wie je ideale klant is. ArnoBot begrijpt direct wie je bent en wat je nodig hebt.</small></span>
            </div>
            <div className="feature-item">
              <span className="feature-arrow">→</span>
              <span className="feature-text">en jouw persoonlijke salesarchief<small>Elk gesprek wordt opgeslagen en blijft voor je beschikbaar. Hoe meer gesprekken je met ArnoBot voert, hoe scherper het inzicht in jouw manier van verkopen en waar de grootste kansen liggen.</small></span>
            </div>
            <div className="feature-item" style={{borderBottom:'none'}}>
              <span className="feature-arrow">→</span>
              <span className="feature-text">naar maximale performance<small>ArnoBot herkent steeds beter jouw patronen, werkwijze en voorkeuren. Daardoor worden de adviezen steeds persoonlijker, relevanter en effectiever. Je ontsluit je maximale groeipotentie.</small></span>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="subscribe-section">
        <div className="subscribe-text-col" style={{alignItems:'center', padding:'80px 60px'}}>
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'20px', textAlign:'center'}}>
            <div style={{background:'transparent', fontFamily:"'Bebas Neue', sans-serif", fontSize:'16px', letterSpacing:'4px', padding:'6px 18px', visibility:'hidden'}}>4 maanden gratis</div>
            <span style={{fontSize:'28px', letterSpacing:'3px', textTransform:'uppercase', color:'#f59e0b', fontFamily:"'Bebas Neue', sans-serif"}}>Per maand</span>
            <div style={{display:'flex', alignItems:'baseline', gap:'8px'}}>
              <span style={{fontFamily:"'Bebas Neue', sans-serif", fontSize:'clamp(28px, 3vw, 44px)', color:'#6b7280', letterSpacing:0}}>€</span>
              <span style={{fontFamily:"'Bebas Neue', sans-serif", fontSize:'clamp(64px, 7vw, 104px)', color:'#f1f5f9', letterSpacing:'-2px', lineHeight:0.9}}>97</span>
            </div>
            <a href="/sign-up" style={{
              display:'inline-block', textDecoration:'none', textAlign:'center',
              background:'#f59e0b', color:'#1e293b', fontFamily:"'Bebas Neue', sans-serif",
              fontSize:'20px', letterSpacing:'3px', padding:'12px 0', width:'150px', borderRadius:'999px',
              transition:'background 0.2s'
            }}>START NU.</a>
            <a href="/sign-up" style={{
              fontSize:'13px', color:'#9ca3af', fontFamily:"'Space Mono', monospace",
              textDecoration:'none', letterSpacing:'1px'
            }}>30 dagen Free Trial</a>
          </div>
        </div>
        <div className="canvas-right" style={{background:'#1e293b', justifyContent:'center', alignItems:'flex-start', padding:'80px 60px'}}>
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'20px', textAlign:'center'}}>
            <div style={{background:'#f1f5f9', color:'#1e293b', fontFamily:"'Bebas Neue', sans-serif", fontSize:'16px', letterSpacing:'4px', textTransform:'uppercase', padding:'6px 18px', display:'inline-block'}}>4 maanden gratis</div>
            <span style={{fontSize:'28px', letterSpacing:'3px', textTransform:'uppercase', color:'#f59e0b', fontFamily:"'Bebas Neue', sans-serif"}}>Per jaar</span>
            <div style={{display:'flex', alignItems:'baseline', gap:'8px'}}>
              <span style={{fontFamily:"'Bebas Neue', sans-serif", fontSize:'clamp(28px, 3vw, 44px)', color:'#6b7280', letterSpacing:0}}>€</span>
              <span style={{fontFamily:"'Bebas Neue', sans-serif", fontSize:'clamp(64px, 7vw, 104px)', color:'#f1f5f9', letterSpacing:'-2px', lineHeight:0.9}}>777</span>
            </div>
            <a href="/sign-up" style={{
              display:'inline-block', textDecoration:'none', textAlign:'center',
              background:'#f59e0b', color:'#1e293b', fontFamily:"'Bebas Neue', sans-serif",
              fontSize:'20px', letterSpacing:'3px', padding:'12px 0', width:'150px', borderRadius:'999px',
              transition:'background 0.2s'
            }}>START NU.</a>
            <a href="/sign-up" style={{
              fontSize:'13px', color:'#9ca3af', fontFamily:"'Space Mono', monospace",
              textDecoration:'none', letterSpacing:'1px'
            }}>30 dagen Free Trial</a>
          </div>
        </div>
        <div style={{gridColumn:'1 / -1', borderTop:'1px solid #374151', padding:'28px 60px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', textAlign:'center'}}>
          <span style={{fontFamily:"'Space Mono', monospace", fontSize:'13px', color:'#9ca3af', letterSpacing:'0.5px'}}>
            Wil je je hele salesteam uitrusten met ArnoBot als persoonlijke coach?
          </span>
          <a href="mailto:arno@arno.bot" style={{
            fontFamily:"'Bebas Neue', sans-serif", fontSize:'18px', letterSpacing:'3px',
            color:'#f59e0b', textDecoration:'none', textTransform:'uppercase', whiteSpace:'nowrap'
          }}>Neem contact op →</a>
        </div>
      </section>

      {/* FEATURES */}
      <section className="canvas-section">
        <div className="canvas-left">
          <div className="canvas-left-inner">
            <div className="feature-item" style={{flexDirection:'row-reverse'}}>
              <span className="feature-arrow">←</span>
              <span className="feature-text" style={{textAlign:'right'}}>Unlimited sales coaching<small>24/7 beschikbaar. Geen limiet. Geen wachttijd.</small></span>
            </div>
            <div className="feature-item" style={{flexDirection:'row-reverse'}}>
              <span className="feature-arrow">←</span>
              <span className="feature-text" style={{textAlign:'right'}}>Jouw sales archief<small>Alles wordt bewaard en is doorzoekbaar.</small></span>
            </div>
            <div className="feature-item" style={{flexDirection:'row-reverse'}}>
              <span className="feature-arrow">←</span>
              <span className="feature-text" style={{textAlign:'right'}}>PDF Export<small>Sorteer en exporteer wat je wilt.</small></span>
            </div>
          </div>
        </div>
        <div className="canvas-right">
          <div style={{maxWidth:'540px', width:'100%'}}>
            <div className="feature-item">
              <span className="feature-arrow">→</span>
              <span className="feature-text">Personal Training<small>Krijg een trainingsschema op maat.</small></span>
            </div>
            <div className="feature-item">
              <span className="feature-arrow">→</span>
              <span className="feature-text">Verdiep je expertise<small>Verwijzing naar blogs, boeken en video's.</small></span>
            </div>
            <div className="feature-item" style={{borderBottom:'none'}}>
              <span className="feature-arrow">→</span>
              <span className="feature-text">Overleg met Arno<small>Niet de bot, maar Arno in persoon. *</small></span>
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
            <h2 className="canvas-title" style={{color:'#f1f5f9'}}>ARNO <span style={{color:'#f59e0b'}}>LIVE.</span></h2>
            <p className="canvas-body" style={{color:'#9ca3af'}}>
              Niet alleen de bot. Arno zelf. Persoonlijke online coaching op basis van jouw specifieke situatie. Voor als je nog harder vooruit wilt.
            </p>
            <p style={{fontFamily:"'Space Mono', monospace", fontSize:'12px', color:'#6b7280', letterSpacing:'0.5px', marginTop:'8px'}}>* Een half uur per kwartaal gratis bij een jaarabonnement.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <Link href="/" className="footer-logo">ARNOBOT.</Link>
        <span className="footer-copy">© Since 2007 · CC BY-ND 4.0</span>
      </footer>
    </>
  )
}
