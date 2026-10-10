import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import SiteFooter from '../SiteFooter'

// Gedeelde omlijsting voor alle blogpagina's (overzicht, artikel, tag, aanmelden/afmelden).
// Marketingstijl, zelfde als /prijzen: Figtree + Oswald, #111827 achtergrond.
export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;600&family=Figtree:wght@400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f8fafc; font-family: 'Figtree', sans-serif; font-size: 16px; }

        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 40px; height: 60px; display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px; color: #f1f5f9; text-decoration: none; }
        .nav-logo span { color: #f59e0b; }
        .nav-spacer { flex: 1; }
        .nav-auth { display: flex; gap: 32px; align-items: center; }
        .nav-login { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px; color: #9ca3af; text-decoration: none; transition: color 0.2s; }
        .nav-login:hover { color: #f1f5f9; }

        .bl-wrap { max-width: 1040px; margin: 0 auto; padding: 140px 24px 80px; }
        .bl-narrow { max-width: 720px; margin: 0 auto; padding: 140px 24px 80px; }
        .bl-label { font-size: 14px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #f59e0b; margin-bottom: 16px; }
        .bl-title { font-family: 'Oswald', sans-serif; font-size: clamp(36px, 5vw, 56px); font-weight: 600; text-transform: uppercase; line-height: 1.1; color: #f8fafc; margin-bottom: 16px; }
        .bl-sub { font-size: 18px; line-height: 1.625; color: #94a3b8; max-width: 640px; }

        .bl-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 32px 0 0; }
        .bl-chip { display: inline-block; font-size: 14px; font-weight: 500; color: #94a3b8; border: 1px solid #374151; border-radius: 999px; padding: 6px 14px; text-decoration: none; transition: color 0.2s, border-color 0.2s; }
        .bl-chip:hover, .bl-chip.active { color: #f59e0b; border-color: #f59e0b; }

        .bl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 28px; margin-top: 48px; }
        .bl-card { display: flex; flex-direction: column; background: #1f2937; border-radius: 6px; overflow: hidden; text-decoration: none; transition: transform 0.2s; }
        .bl-card:hover { transform: translateY(-3px); }
        .bl-card-img { position: relative; aspect-ratio: 16 / 9; background: #111827; }
        .bl-card-body { padding: 20px 22px 24px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .bl-card-tags { font-size: 14px; color: #f59e0b; font-weight: 500; }
        .bl-card-title { font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 600; text-transform: uppercase; line-height: 1.2; color: #f8fafc; }
        .bl-card-sum { font-size: 15px; line-height: 1.6; color: #94a3b8; }
        .bl-card-date { font-size: 14px; color: #94a3b8; margin-top: auto; padding-top: 6px; }

        .bl-empty { margin-top: 56px; font-size: 18px; color: #94a3b8; }

        .bl-back { display: inline-block; font-size: 14px; font-weight: 500; color: #94a3b8; text-decoration: none; margin-bottom: 32px; }
        .bl-back:hover { color: #f59e0b; }
        .bl-article-title { font-family: 'Oswald', sans-serif; font-size: clamp(32px, 5vw, 48px); font-weight: 600; text-transform: uppercase; line-height: 1.1; color: #f8fafc; margin: 12px 0 20px; }
        .bl-meta { font-size: 14px; color: #94a3b8; display: flex; flex-wrap: wrap; gap: 6px 16px; }
        .bl-meta a { color: #f59e0b; text-decoration: none; }
        .bl-cover { position: relative; aspect-ratio: 16 / 9; border-radius: 6px; overflow: hidden; margin: 32px 0 8px; background: #1f2937; }

        .bl-body { margin-top: 32px; font-size: 18px; line-height: 1.75; color: #94a3b8; }
        .bl-body > * + * { margin-top: 20px; }
        .bl-body h2 { font-family: 'Oswald', sans-serif; font-size: 28px; font-weight: 600; text-transform: uppercase; line-height: 1.2; color: #f8fafc; margin-top: 44px; }
        .bl-body h3 { font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 500; text-transform: uppercase; line-height: 1.25; color: #f8fafc; margin-top: 32px; }
        .bl-body strong { color: #f8fafc; font-weight: 600; }
        .bl-body a { color: #f59e0b; text-decoration: underline; text-underline-offset: 3px; }
        .bl-body ul, .bl-body ol { padding-left: 24px; }
        .bl-body li + li { margin-top: 8px; }
        .bl-body blockquote { border-left: 3px solid #f59e0b; padding-left: 20px; color: #f8fafc; }
        .bl-body img { max-width: 100%; height: auto; border-radius: 6px; display: block; }
        .bl-body hr { border: none; border-top: 1px solid #374151; margin: 40px 0; }
        .bl-body code { background: #1f2937; padding: 2px 6px; border-radius: 3px; font-size: 15px; color: #f8fafc; }
        .bl-body pre { background: #1f2937; padding: 16px; border-radius: 6px; overflow-x: auto; }
        .bl-body pre code { padding: 0; background: none; }
        .bl-body table { border-collapse: collapse; width: 100%; font-size: 16px; display: block; overflow-x: auto; }
        .bl-body th, .bl-body td { border: 1px solid #374151; padding: 8px 12px; text-align: left; }
        .bl-body th { color: #f8fafc; }

        .bl-box { margin-top: 56px; padding: 32px; border: 1px solid #374151; border-radius: 6px; background: #1f2937; }
        .bl-notice { margin-bottom: 40px; padding: 16px 20px; font-size: 16px; line-height: 1.5; color: #f8fafc; background: #1f2937; border: 1px solid #374151; border-left: 3px solid #f59e0b; border-radius: 6px; }
        .bl-notice.err { border-left-color: #f87171; }
        .bl-sub-box { max-width: 600px; }
        .bl-box h2 { font-family: 'Oswald', sans-serif; font-size: 26px; font-weight: 600; text-transform: uppercase; color: #f8fafc; margin-bottom: 10px; }
        .bl-box p { font-size: 16px; line-height: 1.6; color: #94a3b8; }
        .bl-form { margin-top: 20px; display: flex; flex-direction: column; gap: 14px; }
        .bl-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .bl-input { flex: 1; min-width: 220px; background: #111827; border: 1.5px solid #374151; border-radius: 6px; padding: 12px 16px; color: #f8fafc; font-family: 'Figtree', sans-serif; font-size: 16px; }
        .bl-input:focus { outline: none; border-color: #f59e0b; }
        .bl-input::placeholder { color: #6b7280; }
        .bl-btn { font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; background: #f59e0b; color: #111827; border: none; border-radius: 6px; padding: 12px 28px; cursor: pointer; text-decoration: none; display: inline-block; box-shadow: 0 12px 24px rgba(245,158,11,0.25); transition: transform 0.2s; }
        .bl-btn:hover { transform: scale(1.03); }
        .bl-btn:disabled { opacity: 0.6; cursor: default; transform: none; }
        .bl-btn-secondary { font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; background: none; color: #94a3b8; border: 1px solid #374151; border-radius: 6px; padding: 12px 28px; cursor: pointer; text-decoration: none; display: inline-block; }
        .bl-btn-secondary:hover { color: #f8fafc; border-color: #94a3b8; }
        .bl-topics { display: flex; flex-wrap: wrap; gap: 8px; }
        .bl-topic { font-family: 'Figtree', sans-serif; font-size: 14px; font-weight: 500; color: #94a3b8; background: none; border: 1px solid #374151; border-radius: 999px; padding: 6px 14px; cursor: pointer; }
        .bl-topic[aria-pressed="true"] { color: #111827; background: #f59e0b; border-color: #f59e0b; }
        .bl-small { font-size: 14px; color: #94a3b8; }
        .bl-small a { color: #94a3b8; }
        .bl-msg { font-size: 15px; color: #f8fafc; }
        .bl-msg.err { color: #f87171; }
        .bl-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

        .bl-related { margin-top: 56px; }
        .bl-related h2 { font-family: 'Oswald', sans-serif; font-size: 24px; font-weight: 600; text-transform: uppercase; color: #f8fafc; }

        @media (max-width: 768px) {
          .site-nav { padding: 0 20px; }
          .bl-wrap, .bl-narrow { padding: 110px 20px 56px; }
          .bl-body { font-size: 17px; }
          .bl-box { padding: 24px 20px; }
        }
      `}</style>

      <nav className="site-nav">
        <Link href="/" className="nav-logo">ARNO<span>BOT.</span></Link>
        <div className="nav-spacer" />
        <div className="nav-auth">
          {userId
            ? <Link href="/bot" className="nav-login">MIJN BOT</Link>
            : <Link href="/sign-in" className="nav-login">LOGIN</Link>}
        </div>
      </nav>

      {children}

      <SiteFooter />
    </>
  )
}
