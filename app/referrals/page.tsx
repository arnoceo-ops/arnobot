import PublicNav from '@/app/components/PublicNav'

export const metadata = {
  title: 'Referral Spelregels: ArnoBot',
  robots: 'noindex',
}

export default function ReferralSpelregelsPage() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        a { color: #f59e0b; text-decoration: none; }
        a:hover { text-decoration: underline; }
        /* Zonder bullets lijken de inspringende regels op een uitlijnfout (de globale reset haalt ze weg). */
        ul { list-style: disc outside; }
        li::marker { color: #f59e0b; }
        li { padding-left: 4px; margin-bottom: 6px; }
        /* Smal scherm: minder letterafstand in de tabelkoppen, anders loopt "REFERRALS" over de volgende kolom. */
        @media (max-width: 520px) {
          th { letter-spacing: 1px; font-size: 11px; padding: 8px 6px; }
          td { font-size: 13px; padding: 8px 6px; overflow-wrap: anywhere; }
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #1f2937; color: #f59e0b; font-family: 'Space Mono', monospace; font-weight: 700; font-size: 13px; letter-spacing: 4px; text-align: left; padding: 10px 14px; border-bottom: 2px solid #f59e0b; }
        td { font-family: 'Space Mono', monospace; font-size: 15px; color: #9ca3af; padding: 10px 14px; border-bottom: 1px solid #374151; vertical-align: top; line-height: 1.9; }
        tr:last-child td { border-bottom: none; }
      `}</style>

      <PublicNav />

      <div style={{ minHeight: '100vh', background: '#111827' }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1.0, marginBottom: 16 }}>REFERRAL SPELREGELS</h1>
          <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 48 }}>Versie 1.8 · November 2026</p>

          <div style={{ borderTop: '3px solid #f59e0b', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 1</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Meedoen</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Deel je link, bijvoorbeeld <strong style={{ color: '#f1f5f9' }}>arno.bot/aanmelden?ref=NAAM-XXXX</strong>. De nieuwe gebruiker meldt zich ermee aan en betaalt binnen de proef of uiterlijk 15 dagen erna (teamproef: 10).</p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 2</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Nieuwe gebruiker: eenmalig een referral fee</h2>
            <ul style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, paddingLeft: 20 }}>
              <li>Per jaar: korting van een twaalfde op het eerste jaar.</li>
              <li>Per maand: na drie betaalde maanden op rij krijg je de vierde gratis. Stap je eerder over op een jaar, dan krijg je de jaarkorting.</li>
              <li>Team: jullie krijgen één maand gratis, tot maximaal de maandprijs bij de start.</li>
            </ul>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 3</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Aanbrenger: eenmalig tegoed per klant</h2>
            <table>
              <thead>
                <tr>
                  <th>KLANT NEEMT</th>
                  <th>WANNEER JE HET KRIJGT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Basic per maand</td>
                  <td>Geen</td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Per jaar</td>
                  <td>Particulier na 14 dagen, zakelijk direct</td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Pro of Team per maand</td>
                  <td>Na 3 betaalde maanden op rij</td>
                </tr>
              </tbody>
            </table>
            <ul style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, paddingLeft: 20 }}>
              <li>Een onderbreking tot 14 dagen mag.</li>
              <li>Hoogte: de laagste van jullie maandprijzen zonder btw, plus btw bij verrekenen.</li>
              <li>Geen maximum aantal klanten. Een team telt als één.</li>
              <li>Begint je klant met Basic per maand en stapt die later over, dan telt dat ook. Het bedrag ligt vast zodra je het tegoed krijgt.</li>
            </ul>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 4</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Verrekenen</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Bij je verlenging, via terugstorting, een overgeslagen incasso of korting op de teamfactuur. De rest blijft staan. Geen uitbetaling in geld. Heb je een vraag over je tegoed? Mail naar <a href="mailto:referrals@arno.bot">referrals@arno.bot</a>.</p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 5</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Vervallen</h2>
            <ul style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, paddingLeft: 20 }}>
              <li>14 dagen na afloop van je abonnement zonder nieuw abonnement.</li>
              <li>Na 30 dagen teamblokkade wegens niet betalen.</li>
              <li>Heb je nog geen abonnement, sluit er dan een af binnen je proef of 15 dagen erna (team: 10).</li>
              <li>Haalt je klant de drempel pas nadat jouw abonnement is gestopt, dan krijg je geen tegoed.</li>
              <li>Word je teamlid, dan storten we je tegoed terug, tot maximaal wat je zelf hebt betaald.</li>
              <li>Bij terugbetaling aan je klant vervalt het bijbehorende tegoed. Al gebruikt? Dan verrekenen we het later.</li>
            </ul>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 6</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Mijlpalen</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 16 }}>Een team dat je als manager aanbrengt telt als één betalende referral, ongeacht het aantal gebruikers.</p>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 20 }}>Bij het bereiken van de volgende aantallen betalende referrals gelden de onderstaande beloningen:</p>
            <table style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '30%' }} />
                <col style={{ width: '70%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th># REFERRALS</th>
                  <th>BELONING</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>50</td>
                  <td>Toegang tot de <strong style={{ color: '#f1f5f9' }}>ArnoBot Ambassadors Club</strong></td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>100</td>
                  <td><strong style={{ color: '#f1f5f9' }}>Lifetime Subscription (Solo Pro)</strong> op ArnoBot</td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>250</td>
                  <td>Persoonlijk aanbod voor deelname in de <strong style={{ color: '#f1f5f9', whiteSpace: 'nowrap' }}>ArnoBot Venture 🚀</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 7</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Uitsluitingen</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Een gebruiker kan zijn of haar eigen referral code niet gebruiken. Codes zijn persoonsgebonden en niet overdraagbaar. Elkaar over en weer aanbrengen telt niet mee. Teamleden hebben geen eigen referral link, de manager van een team heeft die wel.</p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 8</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Wijzigingen</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>ArnoBot behoudt zich het recht voor de voorwaarden van het referralprogramma op elk moment te wijzigen. Bestaand tegoed opgebouwd voor de wijziging blijft geldig onder de oorspronkelijke voorwaarden.</p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32 }}>
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.9 }}>
              Vragen? Mail naar <a href="mailto:referrals@arno.bot">referrals@arno.bot</a>
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
