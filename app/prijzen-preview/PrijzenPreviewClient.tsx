'use client'

import { useState } from 'react'
import Link from 'next/link'

type Cyclus = 'maandelijks' | 'jaarlijks'

export default function PrijzenPreviewClient() {
  const [cyclus, setCyclus] = useState<Cyclus>('maandelijks')

  return (
    <>
      <style>{`
        .prijzen-toggle-wrap { display: flex; justify-content: center; margin-bottom: 40px; }
        .prijzen-toggle {
          display: inline-flex; background: #1e293b; border: 1px solid #374151;
          border-radius: 999px; padding: 4px;
        }
        .prijzen-toggle button {
          font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 2px;
          padding: 8px 24px; border-radius: 999px; border: none; cursor: pointer;
          background: transparent; color: #9ca3af; transition: all 0.2s;
        }
        .prijzen-toggle button.actief { background: #f59e0b; color: #111827; }

        .prijzen-cols { max-width: 820px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .prijzen-tier-card {
          background: #1e293b; border: 1px solid #374151; border-radius: 8px;
          padding: 32px; display: flex; flex-direction: column; gap: 16px;
        }
        .prijzen-tier-kop {
          font-family: 'DM Sans', sans-serif; font-size: 15px; color: #9ca3af; line-height: 1.5; min-height: 46px;
        }
        .prijzen-tier-naam {
          font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: #f59e0b;
          font-family: 'Bebas Neue', sans-serif;
        }
        .prijzen-tier-amount { display: flex; align-items: baseline; gap: 6px; }
        .prijzen-tier-currency { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: #6b7280; }
        .prijzen-tier-num { font-family: 'Bebas Neue', sans-serif; font-size: clamp(40px, 4vw, 52px); color: #f1f5f9; letter-spacing: -1px; line-height: 0.9; }
        .prijzen-tier-periode { font-family: 'DM Sans', sans-serif; font-size: 14px; color: #6b7280; }
        .prijzen-tier-note { font-family: 'DM Sans', sans-serif; font-size: 13px; color: #f59e0b; }
        .prijzen-tier-subnote { font-family: 'DM Sans', sans-serif; font-size: 13px; color: #6b7280; }

        .prijzen-tier-bullets { list-style: none; display: flex; flex-direction: column; gap: 10px; margin: 4px 0; }
        .prijzen-tier-bullets li {
          font-family: 'DM Sans', sans-serif; font-size: 14px; color: #9ca3af; line-height: 1.5;
          padding-left: 18px; position: relative;
        }
        .prijzen-tier-bullets li::before { content: '•'; color: #f59e0b; position: absolute; left: 0; }
        .prijzen-tier-plus {
          font-family: 'DM Sans', sans-serif; font-size: 13px; letter-spacing: 1px;
          text-transform: uppercase; color: #6b7280; margin-top: 4px;
        }

        .prijzen-tier-cta {
          margin-top: auto; display: inline-block; text-decoration: none; text-align: center;
          background: #f59e0b; color: #1e293b; font-family: 'Bebas Neue', sans-serif;
          font-size: 18px; letter-spacing: 2px; padding: 12px 32px; border-radius: 999px;
          transition: background 0.2s;
        }
        .prijzen-tier-cta:hover { background: #d97706; }

        .prijzen-team-section {
          max-width: 820px; margin: 48px auto 0; background: #17202f; border: 1px solid #1f2937;
          border-radius: 8px; padding: 40px;
        }
        .prijzen-team-naam {
          font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: #f59e0b;
          font-family: 'Bebas Neue', sans-serif; margin-bottom: 12px; display: block;
        }
        .prijzen-team-kop {
          font-family: 'Barlow Condensed', sans-serif; font-size: clamp(24px, 3vw, 32px); font-weight: 600;
          color: #f1f5f9; letter-spacing: 0.5px; margin-bottom: 8px;
        }
        .prijzen-team-subkop {
          font-family: 'DM Sans', sans-serif; font-size: 15px; color: #9ca3af; margin-bottom: 28px;
        }
        .prijzen-team-bullets {
          list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px;
          margin-bottom: 28px;
        }
        .prijzen-team-bullets li {
          font-family: 'DM Sans', sans-serif; font-size: 14px; color: #9ca3af; line-height: 1.5;
          padding-left: 18px; position: relative;
        }
        .prijzen-team-bullets li::before { content: '•'; color: #f59e0b; position: absolute; left: 0; }
        .prijzen-team-privacy {
          font-family: 'DM Sans', sans-serif; font-size: 14px; color: #f1f5f9;
          border-left: 2px solid #f59e0b; padding-left: 16px; margin-bottom: 28px; line-height: 1.6;
        }
        .prijzen-team-cta {
          display: inline-block; text-decoration: none; text-align: center;
          background: none; border: 1px solid #f59e0b; color: #f59e0b;
          font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 2px;
          padding: 11px 32px; border-radius: 999px; transition: all 0.2s;
        }
        .prijzen-team-cta:hover { background: #f59e0b; color: #1e293b; }

        @media (max-width: 768px) {
          .prijzen-cols { grid-template-columns: 1fr; }
          .prijzen-team-bullets { grid-template-columns: 1fr; }
          .prijzen-team-section { padding: 28px 24px; }
        }
      `}</style>

      <div className="prijzen-toggle-wrap">
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
      </div>

      <div className="prijzen-cols">
        {/* PREMIUM */}
        <div className="prijzen-tier-card">
          <span className="prijzen-tier-naam">Premium</span>
          <p className="prijzen-tier-kop">Coaching op elk moment, in je eigen tempo.</p>

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
          <p className="prijzen-tier-kop">Coaching, met de mens erachter, gegarandeerd elke maand.</p>

          <div>
            <div className="prijzen-tier-amount">
              <span className="prijzen-tier-currency">€</span>
              <span className="prijzen-tier-num">397</span>
              <span className="prijzen-tier-periode">/ maand</span>
            </div>
            <span className="prijzen-tier-subnote">Alleen maandelijks, vanwege het beperkt aantal plekken.</span>
          </div>

          <span className="prijzen-tier-plus">Alles van Premium, plus:</span>
          <ul className="prijzen-tier-bullets">
            <li>Iedere maand een persoonlijk gesprek met Arno</li>
            <li>Toegang tot de Elite Member Community</li>
            <li>Rechtstreeks contact met Arno via Telegram</li>
          </ul>
          <span className="prijzen-tier-subnote">Zeer beperkt aantal plekken.</span>

          <Link href="/sign-up" className="prijzen-tier-cta">Start nu</Link>
        </div>
      </div>

      {/* TEAM */}
      <div className="prijzen-team-section">
        <span className="prijzen-team-naam">Team</span>
        <h2 className="prijzen-team-kop">Elke 1:1 al voorbereid voordat je begint.</h2>
        <p className="prijzen-team-subkop">Voor sales managers die hun team willen zien groeien.</p>

        <ul className="prijzen-team-bullets">
          <li>Teamoverzicht: individuele scores</li>
          <li>Vroeg signaal bij stagnatie</li>
          <li>Teamvoortgang als trend over tijd</li>
          <li>AI-voorbereiding voor elke 1:1</li>
          <li>Volledig 1:1 archief met eigen notities</li>
          <li>Wekelijkse Team Spotlight</li>
        </ul>

        <p className="prijzen-team-privacy">Eerlijke coaching vraagt om privacy. Jij ziet nooit de gesprekken zelf, alleen wat ertoe doet.</p>

        <a href="mailto:arno@arno.bot?subject=Demo%20ArnoBot%20Team" className="prijzen-team-cta">Vraag een demo aan</a>
      </div>
    </>
  )
}
