import PublicNav from '@/app/components/PublicNav'

export const metadata = {
  title: 'Referral Spelregels: ArnoBot',
  robots: 'noindex',
}

export default function ReferralSpelregelsPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        a { color: #f59e0b; text-decoration: none; }
        a:hover { text-decoration: underline; }
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
          <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 48 }}>Versie 1.1 · Juni 2026</p>

          <div style={{ borderTop: '3px solid #f59e0b', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 1</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Wat is het referralprogramma</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 16 }}>Je ontvangt als actieve ArnoBot-gebruiker een persoonlijke referral link. Deel je die link en meldt iemand zich daarmee aan, dan profiteren zowel jij als de nieuwe gebruiker van een korting zodra de laatstgenoemde een betaald abonnement afsluit.</p>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Deelname is automatisch voor iedere actieve gebruiker. Er zijn geen aparte aanmeldstappen vereist.</p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 2</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Hoe het werkt</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 16 }}>Jij deelt als referrer je persoonlijke link (bijv. <strong style={{ color: '#f1f5f9' }}>arno.bot/aanmelden?ref=NAAM-XXXX</strong>). De nieuwe gebruiker klikt op die link, doorloopt de standaard gratis trial en sluit daarna een abonnement af. Op dat moment worden de kortingen en het tegoed van toepassing.</p>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Een referral code wordt eenmalig per account gekoppeld, op het moment van de eerste inlog via de link.</p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 3</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Kortingen bij conversie</h2>
            <table>
              <thead>
                <tr>
                  <th>WIE</th>
                  <th>SCENARIO</th>
                  <th>VOORDEEL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Nieuwe gebruiker</td>
                  <td>Maandabonnement (€97/m)</td>
                  <td>50% korting eerste maand: €48,50</td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Nieuwe gebruiker</td>
                  <td>Jaarabonnement (€777/j)</td>
                  <td>€97 korting: €680</td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Referrer (maand)</td>
                  <td>Nieuwe gebruiker converteert naar maand</td>
                  <td>50% korting volgende maand: €48,50</td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Referrer (jaar)</td>
                  <td>Nieuwe gebruiker converteert naar maand</td>
                  <td>€48,50 tegoed op jaarverlenging</td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Referrer (maand)</td>
                  <td>Nieuwe gebruiker converteert naar jaar</td>
                  <td>100% korting volgende maand: €97,00</td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Referrer (jaar)</td>
                  <td>Nieuwe gebruiker converteert naar jaar</td>
                  <td>€97,00 tegoed op jaarverlenging</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 4</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Geldigheid van een referral</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Een referral telt mee zodra de nieuwe gebruiker een betaald abonnement afsluit: maand of jaar, direct bij de eerste betaling.</p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 5</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Spelregels voor tegoed</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 16 }}>Tegoed is uitsluitend inzetbaar als verlenging van een bestaand maand- of jaarabonnement, of als bijdrage aan een tweede licentie. Uitbetaling in contanten of via andere betaalmethoden is niet mogelijk.</p>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 16 }}>Tegoed heeft geen vervaldatum en kent geen maximum. Het loopt door totdat het wordt ingezet voor een verlenging of tweede licentie.</p>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>De actuele stand van je referral saldo is te zien op je <a href="/bot/account">accountpagina</a>.</p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 6</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Mijlpalen</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 20 }}>Bij het bereiken van de volgende aantallen betalende referrals gelden de onderstaande beloningen:</p>
            <table>
              <thead>
                <tr>
                  <th>BETALENDE REFERRALS</th>
                  <th>BELONING</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>25</td>
                  <td>Toegang tot de <strong style={{ color: '#f1f5f9' }}>ArnoBot Ambassadors Club</strong></td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>50</td>
                  <td><strong style={{ color: '#f1f5f9' }}>Lifetime Subscription</strong> op ArnoBot</td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>100</td>
                  <td>Persoonlijk aanbod voor deelname in de <strong style={{ color: '#f1f5f9' }}>ArnoBot Venture 🚀</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 7</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Uitsluitingen</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 16 }}>Teamlicenties zijn uitgesloten van het referralprogramma. Kortingen en tegoed gelden alleen voor individuele abonnementen.</p>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Een gebruiker kan zijn of haar eigen referral code niet gebruiken. Codes zijn persoonsgebonden en niet overdraagbaar.</p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 8</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Wijzigingen</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>ArnoBot behoudt zich het recht voor de voorwaarden van het referralprogramma op elk moment te wijzigen. Bestaand tegoed opgebouwd voor de wijziging blijft geldig onder de oorspronkelijke voorwaarden.</p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32 }}>
            <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9 }}>
              Vragen? Mail naar <a href="mailto:referrals@arno.bot">referrals@arno.bot</a>
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
