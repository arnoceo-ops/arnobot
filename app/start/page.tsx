import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import SignupCTA from '../components/SignupCTA'

// Landingpagina voor de folder (QR naar /start?bron=folder-solo), zie docs/FOLDER_PLAN.md.
// Bewust één boodschap en één knop, geen menu: wie scant moet alleen kunnen starten.
// De bron komt uit ?bron= en wordt door PageviewTracker als cookie bewaard.
// Opmaak volgt docs/app-styleguide.md (Bebas Neue en Space Mono, vaste kleurtokens, primaire knop).

export const metadata: Metadata = {
  title: 'ArnoBot: 30 dagen gratis',
  description: 'Sluit meer deals met een coach die al je gesprekken kent. Probeer ArnoBot 30 dagen gratis.',
  // Alleen bedoeld voor wie de folder heeft, niet voor zoekmachines naast de hoofdpagina.
  robots: { index: false, follow: false },
}

const PUNTEN = [
  { titel: 'HIJ ONTHOUDT', tekst: 'Wat je vorige week zei, weet hij nog. Heb je je actie gedaan? Dan vraagt hij ernaar.' },
  { titel: 'HIJ SPIEGELT', tekst: 'Geen standaardadvies, maar vragen en eerlijke terugkoppeling over jouw gedrag.' },
  { titel: 'HIJ LAAT JE OEFENEN', tekst: 'Sparren tegen een lastige prospect of sceptische CFO, met debrief.' },
  { titel: 'HIJ MEET', tekst: 'Mindset, systeem en actie, uitgewerkt in een coachingrapport.' },
]

export default async function StartPage() {
  const { userId } = await auth()
  if (userId) redirect('/bot')
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        .start-wrap { min-height: 100vh; background: #111827; }
        .start-inner {
          max-width: 812px; margin: 0 auto; padding: clamp(40px,8vw,72px) clamp(16px,4vw,20px) 80px;
          display: flex; flex-direction: column; align-items: flex-start; gap: 36px;
        }
        .start-logo { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 3px; color: #f1f5f9; }
        .start-logo span { color: #f59e0b; }
        .start-h1 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(44px,10vw,64px); letter-spacing: 3px; line-height: 1.05; color: #f1f5f9; font-weight: 400; }
        .start-sub { font-size: 15px; line-height: 1.9; color: #9ca3af; max-width: 560px; }
        /* Dezelfde pil als .nav-cta-btn op de hoofdpagina (app/page.tsx), op eigen breedte. */
        .start-cta {
          font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px;
          padding: 8px 20px; border-radius: 999px; background: #f59e0b; color: #111827;
          text-decoration: none; transition: background 0.2s;
        }
        .start-cta:hover { background: #d97706; }
        .start-cta:focus-visible { outline: 2px solid #f59e0b; outline-offset: 3px; }
        .start-punten { width: 100%; display: flex; flex-direction: column; gap: 28px; border-top: 1px solid #374151; padding-top: 32px; }
        .start-punt-titel { font-size: 13px; letter-spacing: 4px; color: #f59e0b; margin-bottom: 8px; }
        .start-punt-tekst { font-size: 15px; line-height: 1.9; color: #9ca3af; max-width: 560px; }
        .start-slot { font-size: 13px; line-height: 1.9; color: #6b7280; max-width: 560px; }
      `}</style>
      <main className="start-wrap">
        <div className="start-inner">
          <div className="start-logo">ARNO<span>BOT</span></div>

          <h1 className="start-h1">SLUIT MEER DEALS MET EEN COACH DIE AL JE GESPREKKEN KENT.</h1>
          <p className="start-sub">Probeer ArnoBot 30 dagen gratis. Daarna maak je zelf een keuze.</p>

          <SignupCTA className="start-cta">30 DAGEN GRATIS</SignupCTA>

          <div className="start-punten">
            {PUNTEN.map(p => (
              <div key={p.titel}>
                <div className="start-punt-titel">{p.titel}</div>
                <div className="start-punt-tekst">{p.tekst}</div>
              </div>
            ))}
          </div>

          <p className="start-slot">Gebouwd op de methode van Arno Diepeveen, oprichter van Royal Dutch Sales.</p>

          <SignupCTA className="start-cta">30 DAGEN GRATIS</SignupCTA>
        </div>
      </main>
    </>
  )
}
