'use client'

import { useState } from 'react'
import Link from 'next/link'

type Cyclus = 'maandelijks' | 'jaarlijks'

export default function PrijzenClient() {
  const [cyclus, setCyclus] = useState<Cyclus>('maandelijks')

  return (
    <>
      <style>{`
        .prijzen-groep-kop {
          text-align: center; font-family: 'Oswald', sans-serif; font-size: clamp(22px, 3vw, 28px);
          font-weight: 600; text-transform: uppercase; color: #f8fafc; margin-bottom: 28px;
        }

        .prijzen-toggle {
          display: inline-flex; background: #111827; border: 1px solid #374151;
          border-radius: 999px; padding: 3px; align-self: flex-start;
        }
        .prijzen-toggle button {
          font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 12px; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 6px 16px; border-radius: 999px; border: none; cursor: pointer;
          background: transparent; color: #94a3b8; transition: all 0.2s;
        }
        .prijzen-toggle button.actief { background: #f59e0b; color: #111827; }

        .prijzen-cols { max-width: 820px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .prijzen-tier-card {
          background: #1e293b; border: 1px solid #374151; border-radius: 12px;
          padding: 32px; display: flex; flex-direction: column; gap: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .prijzen-tier-kop {
          font-size: 15px; color: #f8fafc; line-height: 1.5; min-height: 46px;
        }
        .prijzen-tier-scarcity {
          font-size: 15px; font-weight: 400; color: #f59e0b;
        }
        .prijzen-tier-naam {
          font-size: 13px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #f59e0b;
        }
        .prijzen-tier-amount { display: flex; align-items: baseline; gap: 6px; }
        .prijzen-tier-currency { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 20px; color: #6b7280; }
        .prijzen-tier-num { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: clamp(40px, 4vw, 52px); color: #f8fafc; letter-spacing: -0.5px; line-height: 0.9; }
        .prijzen-tier-periode { font-size: 14px; color: #6b7280; }
        .prijzen-tier-note { font-size: 13px; color: #f59e0b; }
        .prijzen-tier-subnote { font-size: 13px; color: #6b7280; }

        .prijzen-tier-bullets { list-style: none; display: flex; flex-direction: column; gap: 10px; margin: 4px 0; }
        .prijzen-tier-bullets li {
          font-size: 14px; color: #94a3b8; line-height: 1.5;
          padding-left: 18px; position: relative;
        }
        .prijzen-tier-bullets li::before { content: '•'; color: #f59e0b; position: absolute; left: 0; }
        .prijzen-tier-plus {
          font-size: 13px; font-weight: 500; letter-spacing: 0.1em;
          text-transform: uppercase; color: #6b7280; margin-top: 4px;
        }

        .prijzen-tier-cta {
          margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center;
          text-decoration: none; text-align: center; border-radius: 6px; background: #f59e0b;
          padding: 12px 24px; font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 600;
          letter-spacing: 0.1em; color: #111827; text-transform: uppercase;
          box-shadow: 0 12px 24px rgba(245,158,11,0.25); transition: transform 0.2s;
        }
        .prijzen-tier-cta:hover { transform: scale(1.05); }

        .prijzen-command-groep { margin-top: 80px; }
        .prijzen-command-card {
          max-width: 600px; margin: 0 auto; background: #1e293b; border: 1px solid #374151;
          border-radius: 12px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          display: flex; flex-direction: column; gap: 16px;
        }
        .prijzen-command-naam {
          font-size: 13px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #f59e0b;
        }
        .prijzen-command-kop {
          font-size: 15px; color: #f8fafc; line-height: 1.5;
        }
        .prijzen-command-bullets {
          list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 32px; margin: 4px 0;
        }
        .prijzen-command-bullets li {
          font-size: 14px; color: #94a3b8; line-height: 1.5;
          padding-left: 18px; position: relative;
        }
        .prijzen-command-bullets li::before { content: '•'; color: #f59e0b; position: absolute; left: 0; }
        .prijzen-command-privacy {
          font-size: 13px; color: #f8fafc;
          border-left: 2px solid #f59e0b; padding-left: 16px; line-height: 1.6;
        }
        .prijzen-command-cta {
          margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center;
          text-decoration: none; text-align: center; border-radius: 6px; background: #f59e0b;
          padding: 12px 24px; font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 600;
          letter-spacing: 0.1em; color: #111827; text-transform: uppercase;
          box-shadow: 0 12px 24px rgba(245,158,11,0.25); transition: transform 0.2s;
        }
        .prijzen-command-cta:hover { transform: scale(1.05); }

        @media (max-width: 768px) {
          .prijzen-cols { grid-template-columns: 1fr; }
          .prijzen-command-bullets { grid-template-columns: 1fr; }
        }
      `}</style>

      <h2 className="prijzen-groep-kop">Individueel</h2>
      <div className="prijzen-cols">
        {/* PREMIUM */}
        <div className="prijzen-tier-card">
          <span className="prijzen-tier-naam">Premium</span>
          <p className="prijzen-tier-kop">Coaching op elk moment, in je eigen tempo.</p>
          <p className="prijzen-tier-scarcity" style={{ visibility: 'hidden' }} aria-hidden="true">Beperkt aantal plekken.</p>

          <div className="prijzen-toggle">
            <button
              className={cyclus === 'maandelijks' ? 'actief' : ''}
              onClick={() => setCyclus('maandelijks')}
            >
              MAANDELIJKS
            </button>
            <button
              className={cyclus === 'jaarlijks' ? 'actief' : ''}
              onClick={() => setCyclus('jaarlijks')}
            >
              JAARLIJKS
            </button>
          </div>

          <div>
            <div className="prijzen-tier-amount">
              <span className="prijzen-tier-currency">€</span>
              <span className="prijzen-tier-num">{cyclus === 'maandelijks' ? '97' : '777'}</span>
              <span className="prijzen-tier-periode">{cyclus === 'maandelijks' ? '/ maand' : '/ jaar'}</span>
            </div>
            {cyclus === 'jaarlijks' && <span className="prijzen-tier-note">4 maanden gratis</span>}
          </div>

          <ul className="prijzen-tier-bullets">
            <li>Onbeperkt aantal gesprekken</li>
            <li>Onbeperkt aantal gespreksanalyses</li>
            <li>Actiegericht coachingsadvies</li>
            <li>Sparring met een realistische gesprekspartner</li>
            <li>Gesproken antwoorden</li>
            <li>Alle output terug te vinden in archief</li>
          </ul>

          <Link href="/sign-up" className="prijzen-tier-cta">Start nu</Link>
        </div>

        {/* ELITE */}
        <div className="prijzen-tier-card">
          <span className="prijzen-tier-naam">Elite</span>
          <p className="prijzen-tier-kop">Man & Machine. Arno zelf wordt ingeschakeld.</p>
          <p className="prijzen-tier-scarcity">Beperkt aantal plekken.</p>

          <div className="prijzen-toggle" style={{ visibility: 'hidden' }} aria-hidden="true">
            <button>MAANDELIJKS</button>
            <button>JAARLIJKS</button>
          </div>

          <div>
            <div className="prijzen-tier-amount">
              <span className="prijzen-tier-currency">€</span>
              <span className="prijzen-tier-num">397</span>
              <span className="prijzen-tier-periode">/ maand</span>
            </div>
          </div>

          <span className="prijzen-tier-plus">Alles van Premium, plus:</span>
          <ul className="prijzen-tier-bullets">
            <li>Iedere maand een persoonlijk gesprek met Arno</li>
            <li>Rechtstreeks contact met Arno via Telegram</li>
            <li>Toegang tot de Elite Member Community</li>
          </ul>

          <Link href="/sign-up" className="prijzen-tier-cta">Start nu</Link>
        </div>
      </div>

      {/* COMMAND */}
      <div className="prijzen-command-groep">
        <h2 className="prijzen-groep-kop">Team</h2>
        <div className="prijzen-command-card">
          <span className="prijzen-command-naam">Command</span>
          <p className="prijzen-command-kop">Elke 1:1 al voorbereid voordat je begint.</p>

          <ul className="prijzen-command-bullets">
            <li>Teamoverzicht: individuele scores</li>
            <li>Teamvoortgang als trend over tijd</li>
            <li>Vroeg signaal bij stagnatie</li>
            <li>AI-voorbereiding voor elke 1:1</li>
            <li>Volledig 1:1 archief met eigen notities</li>
            <li>Wekelijkse Team Spotlight</li>
          </ul>

          <p className="prijzen-command-privacy">Managers zien nooit de inhoud van de gesprekken, alleen wat ertoe doet.</p>

          <Link href="/command-aanvraag" className="prijzen-command-cta">Vraag een demo aan</Link>
        </div>
      </div>
    </>
  )
}
