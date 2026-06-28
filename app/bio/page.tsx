import Link from 'next/link'
import { client } from '@/sanity/client'
import { PortableText } from '@portabletext/react'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

async function getBioPage() {
  return await client.fetch(`*[_type == "bioPage"][0]`, {}, { next: { revalidate: 0 } })
}

export default async function BioPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/')

  const { userId } = await auth()
  const bio = await getBioPage()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Barlow:wght@400;700&family=Barlow+Condensed:wght@300;600;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }

        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 40px; height: 60px; display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-spacer { flex: 1; }
        .nav-links { display: flex; gap: 48px; align-items: center; }
        .nav-btn {
          color: #9ca3af; text-decoration: none;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 3px; transition: color 0.2s;
        }
        .nav-btn:hover { color: #f1f5f9; }
        .nav-links a {
          color: #9ca3af; text-decoration: none;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 3px; transition: color 0.2s;
        }
        .nav-links a:hover { color: #f1f5f9; }
        .nav-active { color: #f59e0b !important; }
        .nav-cta { color: #f59e0b !important; }

        .bio-hero { padding-top: 80px; background: #111827; }
        .bio-hero-inner {
          padding: 80px 60px 60px;
          border-bottom: 3px solid #f59e0b;
          display: flex; justify-content: space-between; align-items: flex-end;
        }
        .bio-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(64px, 10vw, 120px); line-height: 0.9;
        }
        .bio-title-arno { color: #f59e0b; display: block; }
        .bio-title-diepeveen { color: #f1f5f9; display: block; }
        .bio-tagline { text-align: right; padding-bottom: 8px; max-width: 420px; }
        .bio-tagline-title {
          font-family: 'Barlow', sans-serif;
          font-size: 26px; font-weight: 700; color: #f1f5f9;
          display: block; margin-bottom: 8px; letter-spacing: 0.5px;
        }
        .bio-tagline-sub { font-family: 'Space Mono', monospace; font-size: 15px; line-height: 1.9; color: #9ca3af; display: block; }

        .bio-body {
          max-width: 960px; margin: 0 auto;
          padding: 80px 60px 120px;
          display: flex; flex-direction: column; gap: 60px;
        }
        .bio-video { width: 800px; max-width: 100%; margin: 0 auto; }
        .bio-text { width: 800px; max-width: 100%; margin: 0 auto; }
        .bio-text p { font-size: 15px; line-height: 1.875; color: #9ca3af; margin-bottom: 28px; }
        .bio-text strong { color: #f1f5f9; font-weight: 700; }
        .bio-text em { color: #f59e0b; font-style: normal; }

        footer {
          background: #0d1117; padding: 40px 60px;
          display: flex; justify-content: space-between; align-items: center;
          border-top: 1px solid #1f2937;
        }
        .footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #f59e0b; letter-spacing: 3px; }
        .footer-copy { font-size: 10px; color: #374151; }
      `}</style>

      <nav className="site-nav">
        <div className="nav-spacer" />
        <div className="nav-links">
          <Link href="/">HOME</Link>
          <Link href="/bio" className="nav-active">ARNO</Link>
          <a href="https://www.arno.bot/">BOT</a>
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

      <div className="bio-hero">
        <div className="bio-hero-inner">
          <h1 className="bio-title">
            <span className="bio-title-arno">ARNO</span>
            <span className="bio-title-diepeveen">DIEPEVEEN.</span>
          </h1>
          <div className="bio-tagline">
            <span className="bio-tagline-title">{bio?.taglineTitle}</span>
            <span className="bio-tagline-sub">{bio?.taglineSub}</span>
          </div>
        </div>
      </div>

      <div className="bio-body">
        <div className="bio-video">
          <div style={{position:'relative',overflow:'hidden',paddingBottom:'56.25%'}}>
            <iframe
              src="https://cdn.jwplayer.com/players/e737ObvZ-NOqL4ECN.html"
              width="100%" height="100%"
              frameBorder="0"
              scrolling="no"
              title="ABOUT ARNO"
              style={{position:'absolute',top:0,left:0}}
              allowFullScreen
            />
          </div>
        </div>
        <div className="bio-text">
          {bio?.body && <PortableText value={bio.body} />}
        </div>
      </div>

      <footer>
        <span className="footer-logo">Royal Dutch Sales</span>
        <span className="footer-copy">© Since 2007 · CC BY-ND 4.0</span>
      </footer>
    </>
  )
}
