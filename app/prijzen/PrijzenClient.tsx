'use client'

import { useState } from 'react'
import SignupCTA from '../components/SignupCTA'

type Cyclus = 'maandelijks' | 'jaarlijks'

// Eén bron voor de getoonde bedragen: zowel de kaarten als het live-berekende
// kortingspercentage bij de toggle lezen hieruit, zodat een toekomstige
// prijswijziging nooit een verouderd "bespaar X%"-label kan achterlaten
// (besloten 2026-08-10, zie docs/PRICING_DECISIONS.md voor de "geen
// hardgecodeerde besparingstekst"-reden die hiermee wordt opgelost).
const BASIC_MAANDELIJKS = 29
const BASIC_JAARLIJKS = 19
const PRO_MAANDELIJKS = 59
const PRO_JAARLIJKS = 39
const basicKortingPct = Math.round((1 - BASIC_JAARLIJKS / BASIC_MAANDELIJKS) * 100)
const proKortingPct = Math.round((1 - PRO_JAARLIJKS / PRO_MAANDELIJKS) * 100)
// Team heeft een lager, apart percentage (~20%, zie PRICING_DECISIONS.md),
// daarom "tot X%": een waarachtige bovengrens i.p.v. een gemiddelde dat voor
// geen enkele kaart precies klopt.
const maxKortingPct = Math.max(basicKortingPct, proKortingPct)

export default function PrijzenClient({ demoLink }: { demoLink: string | null }) {
  const [cyclus, setCyclus] = useState<Cyclus>('jaarlijks')

  return (
    <>
      <style>{`
        .prijzen-toggle-rij {
          display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 40px;
        }
        .prijzen-toggle {
          display: inline-flex; background: #111827; border: 1px solid #374151;
          border-radius: 999px; padding: 3px;
        }
        .prijzen-toggle button {
          font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 12px; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 7px 18px; border-radius: 999px; border: none; cursor: pointer;
          background: transparent; color: #94a3b8; transition: all 0.2s;
        }
        .prijzen-toggle button.actief { background: #f59e0b; color: #111827; }
        .prijzen-toggle-korting { font-size: 13px; color: #f59e0b; min-height: 18px; }

        .prijzen-cols { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
        .prijzen-tier-card {
          background: #1e293b; border: 1px solid #374151; border-radius: 12px;
          padding: 32px; display: flex; flex-direction: column; gap: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .prijzen-tier-card.aanbevolen { border-color: rgba(245,158,11,0.35); }
        .prijzen-tier-kop {
          font-size: 15px; color: #f8fafc; line-height: 1.5; min-height: 46px;
        }
        .prijzen-tier-naam {
          font-size: 13px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #f59e0b;
        }

        .prijzen-tier-price-block { display: flex; flex-direction: column; gap: 8px; min-height: 104px; }
        .prijzen-tier-amount { display: flex; align-items: baseline; gap: 10px; }
        .prijzen-tier-currency { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 20px; color: #6b7280; }
        .prijzen-tier-num { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: clamp(40px, 4vw, 52px); color: #f8fafc; letter-spacing: -0.5px; line-height: 0.9; }
        .prijzen-tier-periode { font-size: 14px; color: #6b7280; }
        .prijzen-tier-billingnote { font-size: 13px; color: #94a3b8; min-height: 18px; }
        .prijzen-tier-trial { font-size: 13px; color: #f59e0b; min-height: 18px; }

        .prijzen-tier-bullets { list-style: none; display: flex; flex-direction: column; gap: 10px; margin: 4px 0; flex: 1; }
        .prijzen-tier-bullets li {
          font-size: 14px; color: #94a3b8; line-height: 1.5; min-height: 21px;
          padding-left: 18px; position: relative;
        }
        .prijzen-tier-bullets li::before { content: '•'; color: #f59e0b; position: absolute; left: 0; }
        .prijzen-tier-plus {
          font-size: 13px; font-weight: 500; letter-spacing: 0.1em;
          text-transform: uppercase; color: #6b7280; margin-top: 4px;
        }

        .prijzen-tier-cta {
          margin-top: 24px; display: flex; align-items: center; justify-content: center;
          text-decoration: none; text-align: center; border-radius: 6px; background: #f59e0b;
          padding: 12px 24px; font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 600;
          letter-spacing: 0.1em; color: #111827; text-transform: uppercase;
          box-shadow: 0 12px 24px rgba(245,158,11,0.25); transition: transform 0.2s;
        }
        .prijzen-tier-cta:hover { transform: scale(1.05); }
        .prijzen-tier-cta.secundair {
          background: transparent; color: #f59e0b; border: 1.5px solid #f59e0b; box-shadow: none;
        }
        .prijzen-tier-cta.secundair:hover { background: rgba(245,158,11,0.08); }

        @media (max-width: 900px) {
          .prijzen-cols { grid-template-columns: 1fr; max-width: 480px; }
        }
      `}</style>

      <div className="prijzen-toggle-rij">
        <div className="prijzen-toggle">
          <button
            className={cyclus === 'jaarlijks' ? 'actief' : ''}
            onClick={() => setCyclus('jaarlijks')}
          >
            JAARLIJKS
          </button>
          <button
            className={cyclus === 'maandelijks' ? 'actief' : ''}
            onClick={() => setCyclus('maandelijks')}
          >
            MAANDELIJKS
          </button>
        </div>
        {cyclus === 'jaarlijks' && (
          <p className="prijzen-toggle-korting">Bespaar tot {maxKortingPct}% bij jaarbetaling</p>
        )}
      </div>

      <div className="prijzen-cols">
        {/* BASIC */}
        <div className="prijzen-tier-card">
          <span className="prijzen-tier-naam">Basic</span>
          <p className="prijzen-tier-kop">24/7 ongefilterd advies</p>

          <div className="prijzen-tier-price-block">
            <div className="prijzen-tier-amount">
              <span className="prijzen-tier-currency">€</span>
              <span className="prijzen-tier-num">{cyclus === 'jaarlijks' ? BASIC_JAARLIJKS : BASIC_MAANDELIJKS}</span>
              <span className="prijzen-tier-periode">/ maand</span>
            </div>
            <p className="prijzen-tier-billingnote">
              {cyclus === 'jaarlijks' ? `€${BASIC_JAARLIJKS * 12} per jaar.` : 'Maandelijks opzegbaar.'}
            </p>
            <p className="prijzen-tier-trial">30 dagen gratis proberen</p>
          </div>

          <ul className="prijzen-tier-bullets">
            <li>Dagelijks sparren met ArnoBot</li>
            <li>Eén gespreksanalyse per dag</li>
            <li>Geheugen over je recente gesprekken</li>
          </ul>

          <SignupCTA className="prijzen-tier-cta">Start nu</SignupCTA>
        </div>

        {/* PRO */}
        <div className="prijzen-tier-card aanbevolen">
          <span className="prijzen-tier-naam">Pro</span>
          <p className="prijzen-tier-kop">Je topcoach, altijd binnen handbereik.</p>

          <div className="prijzen-tier-price-block">
            <div className="prijzen-tier-amount">
              <span className="prijzen-tier-currency">€</span>
              <span className="prijzen-tier-num">{cyclus === 'jaarlijks' ? PRO_JAARLIJKS : PRO_MAANDELIJKS}</span>
              <span className="prijzen-tier-periode">/ maand</span>
            </div>
            <p className="prijzen-tier-billingnote">
              {cyclus === 'jaarlijks' ? `€${PRO_JAARLIJKS * 12} per jaar.` : 'Maandelijks opzegbaar.'}
            </p>
            <p className="prijzen-tier-trial">30 dagen gratis proberen</p>
          </div>

          <span className="prijzen-tier-plus">Alles van Basic, plus:</span>
          <ul className="prijzen-tier-bullets">
            <li>Onbeperkt chatten en oefenen</li>
            <li>Uitgebreider gespreksgeheugen</li>
            <li>Volledig archief van al je output</li>
            <li>Coaching op mindset, systeem en actie</li>
            <li>Gesproken antwoorden, Arno's stem</li>
            <li>De ArnoBot-app (Android)</li>
          </ul>

          <SignupCTA className="prijzen-tier-cta">Start nu</SignupCTA>
        </div>

        {/* TEAM */}
        <div className="prijzen-tier-card">
          <span className="prijzen-tier-naam">Team</span>
          <p className="prijzen-tier-kop">Je hele team, scherp in beeld.</p>

          <div className="prijzen-tier-price-block">
            <div className="prijzen-tier-amount">
              <span className="prijzen-tier-currency">€</span>
              <span className="prijzen-tier-num">{cyclus === 'jaarlijks' ? '77' : '97'}</span>
              <span className="prijzen-tier-periode">/ maand</span>
            </div>
            <p className="prijzen-tier-billingnote">
              {cyclus === 'jaarlijks' ? '+ €39 per gebruiker, vanaf 3 gebruikers' : '+ €49 per gebruiker, vanaf 3 gebruikers'}
            </p>
            <p className="prijzen-tier-billingnote">
              {cyclus === 'jaarlijks' ? '€924 + €468 per gebruiker, per jaar' : 'Maandelijks opzegbaar.'}
            </p>
          </div>

          <span className="prijzen-tier-plus">Alles van Pro, plus:</span>
          <ul className="prijzen-tier-bullets">
            <li>Eigen leiderschapsaccount</li>
            <li>Teamoverzicht: individuele scores</li>
            <li>Teamvoortgang als trend over tijd</li>
            <li>Vroeg signaal bij stagnatie</li>
            <li>AI-voorbereiding voor elke 1:1</li>
            <li>Volledig 1:1 archief met eigen notities</li>
          </ul>

          {demoLink
            ? <a href={demoLink} target="_blank" rel="noopener noreferrer" className="prijzen-tier-cta secundair">Bekijk Team</a>
            : <a href="mailto:arno@arno.bot?subject=Team%20ArnoBot" className="prijzen-tier-cta secundair">Bekijk Team</a>
          }
        </div>
      </div>
    </>
  )
}
