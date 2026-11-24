import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import SignupCTA from '../components/SignupCTA'

// Landingpagina voor de folder (QR naar /start?bron=folder-solo), zie docs/FOLDER_PLAN.md.
// Bewust één boodschap en één knop, geen menu: wie scant moet alleen kunnen starten.
// De bron komt uit ?bron= en wordt door PageviewTracker als cookie bewaard.

export const metadata: Metadata = {
  title: 'ArnoBot: 30 dagen gratis',
  description: 'De salescoach die je gesprekken onthoudt. Probeer ArnoBot 30 dagen gratis.',
  // Alleen bedoeld voor wie de folder heeft, niet voor zoekmachines naast de hoofdpagina.
  robots: { index: false, follow: false },
}

const PUNTEN = [
  { titel: 'Hij onthoudt', tekst: 'Wat je vorige week zei, weet hij nog. Heb je je actie gedaan? Dan vraagt hij ernaar.' },
  { titel: 'Hij spiegelt', tekst: 'Geen standaardadvies, maar vragen en eerlijke terugkoppeling over jouw gedrag.' },
  { titel: 'Hij laat je oefenen', tekst: 'Sparren tegen een lastige prospect of sceptische CFO, met debrief.' },
  { titel: 'Hij meet', tekst: 'Mindset, systeem en actie, uitgewerkt in een coachingrapport.' },
]

export default async function StartPage() {
  const { userId } = await auth()
  if (userId) redirect('/bot')
  return (
    <>
      <style>{`
        .start-body { min-height: 100vh; background: #111827; color: #f8fafc; font-family: 'Figtree', sans-serif; }
        .start-inner { margin: 0 auto; max-width: 560px; padding: 40px 24px 56px; display: flex; flex-direction: column; gap: 32px; }
        .start-logo { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px; color: #f1f5f9; }
        .start-logo span { color: #f59e0b; }
        .start-h1 { font-family: 'Oswald', sans-serif; font-size: 40px; font-weight: 600; text-transform: uppercase; line-height: 1.05; text-wrap: balance; }
        .start-h1 span { color: #f59e0b; }
        .start-sub { font-size: 18px; line-height: 1.6; color: #94a3b8; text-wrap: pretty; }
        /* Dezelfde pil als .nav-cta-btn op de hoofdpagina (app/page.tsx). align-self houdt hem
           op eigen breedte in plaats van kolombreed. */
        .start-cta {
          align-self: flex-start;
          font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px;
          color: #111827; text-decoration: none; background: #f59e0b;
          padding: 8px 20px; border-radius: 999px; transition: background 0.2s;
        }
        .start-cta:hover { background: #d97706; }
        .start-cta:focus-visible { outline: 2px solid #f59e0b; outline-offset: 2px; }
        .start-punten { display: flex; flex-direction: column; gap: 20px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 28px; }
        .start-punt-titel { font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: #f59e0b; margin-bottom: 4px; }
        .start-punt-tekst { font-size: 16px; line-height: 1.55; color: #cbd5e1; }
        .start-slot { font-size: 14px; line-height: 1.55; color: #94a3b8; }
        @media (min-width: 640px) { .start-h1 { font-size: 52px; } }
      `}</style>
      <main className="start-body">
        <div className="start-inner">
          <div className="start-logo">ARNO<span>BOT</span></div>

          <h1 className="start-h1">De salescoach die <span>je gesprekken onthoudt</span></h1>
          <p className="start-sub">Probeer ArnoBot 30 dagen gratis. Daarna maak je zelf een keuze.</p>

          <SignupCTA className="start-cta">30 dagen gratis</SignupCTA>

          <div className="start-punten">
            {PUNTEN.map(p => (
              <div key={p.titel}>
                <div className="start-punt-titel">{p.titel}</div>
                <div className="start-punt-tekst">{p.tekst}</div>
              </div>
            ))}
          </div>

          <p className="start-slot">Gebouwd op de methode van Arno Diepeveen, oprichter van Royal Dutch Sales.</p>

          <SignupCTA className="start-cta">30 dagen gratis</SignupCTA>
        </div>
      </main>
    </>
  )
}
