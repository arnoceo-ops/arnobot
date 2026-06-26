import PublicNav from '@/app/components/PublicNav'

export const metadata = {
  title: 'Privacy: ArnoBot',
  robots: 'noindex',
}

export default function PrivacyPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        a { color: #f59e0b; text-decoration: none; }
        a:hover { text-decoration: underline; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #1f2937; color: #f59e0b; font-family: 'Space Mono', monospace; font-size: 13px; letter-spacing: 4px; font-weight: 400; text-align: left; padding: 10px 14px; border-bottom: 1px solid #374151; }
        td { font-family: 'Space Mono', monospace; font-size: 15px; color: #9ca3af; padding: 10px 14px; border-bottom: 1px solid #374151; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
      `}</style>

      <PublicNav />

      <div style={{ minHeight: '100vh', background: '#111827' }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1.0, marginBottom: 16 }}>PRIVACY.</h1>
          <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 48 }}>
            Jouw gegevens zijn van jou. Hier lees je precies wat we opslaan, waarom, hoe lang, en wie er verder bij betrokken is.
          </p>

          <div style={{ borderTop: '3px solid #f59e0b', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 1</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Verantwoordelijke</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 20 }}>
              ArnoBot (arno.bot) is een product van Royal Dutch Sales, gevestigd in Lissabon, Portugal.
            </p>
            <table>
              <tbody>
                <tr><td style={{ color: '#f1f5f9', width: '40%' }}>Bedrijf</td><td>Royal Dutch Sales</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Handelsnaam</td><td>ArnoBot</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Vestigingsplaats</td><td>Lissabon, Portugal</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Contactpersoon</td><td>Arno Diepeveen</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Privacycontact</td><td><a href="mailto:privacy@arno.bot">privacy@arno.bot</a></td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 2</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Welke gegevens we verwerken</h2>
            <table>
              <thead>
                <tr><th>Categorie</th><th>Toelichting</th></tr>
              </thead>
              <tbody>
                <tr><td style={{ color: '#f1f5f9' }}>Accountgegevens</td><td>Naam en e-mailadres, afkomstig uit jouw LinkedIn-profiel via Clerk</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Profielgegevens</td><td>Salesrol, markt, uitdagingen en doelstellingen die jij invult</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Gesprekslogs</td><td>AI-coachingsgesprekken die jij voert met ArnoBot</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Technische gegevens</td><td>IP-adres en sessiedata, uitsluitend voor beveiliging en foutopsporing</td></tr>
              </tbody>
            </table>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>
              Bijzondere categorieën persoonsgegevens (artikel 9 AVG) worden niet verwerkt.
            </p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 3</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Waarvoor we het gebruiken</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {[
                'Het verlenen van toegang tot ArnoBot',
                'Het opslaan en tonen van jouw coachingsgesprekken en profiel',
                'Het genereren van persoonlijke AI-coaching via Anthropic',
                'Het versturen van transactionele e-mails (welkom, trial)',
                'Het beveiligen van de dienst en het opsporen van fouten',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ color: '#f59e0b', flexShrink: 0 }}>·</span>
                  <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>{item}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>
              Jouw gegevens worden nooit verkocht aan derden, gebruikt voor marketing of gedeeld buiten de hieronder genoemde sub-verwerkers.
            </p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 4</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Beveiliging</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Versleutelde verbindingen (HTTPS/TLS) voor al het datatransport',
                'Row Level Security (RLS) in de database. Jij hebt uitsluitend toegang tot jouw eigen data.',
                'Authenticatie via Clerk (SOC 2 Type II gecertificeerd)',
                'Toegangscontrole via JWT-tokens en server-side API routes',
                'Geautomatiseerde monitoring voor foutdetectie',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ color: '#f59e0b', flexShrink: 0 }}>·</span>
                  <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 5</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Sub-verwerkers</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 20 }}>
              ArnoBot maakt gebruik van de volgende partijen. Alle sub-verwerkers zijn contractueel gebonden aan vertrouwelijkheid en voldoen aan de AVG.
            </p>
            <table>
              <thead>
                <tr><th>Partij</th><th>Doel</th><th>DPA</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Supabase</td>
                  <td>Database en opslag van gesprekken en profiel</td>
                  <td>EU · SOC 2 Type II</td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Clerk</td>
                  <td>Authenticatie en gebruikersbeheer (LinkedIn OAuth)</td>
                  <td><a href="https://clerk.com/legal/dpa" target="_blank" rel="noopener noreferrer">clerk.com/legal/dpa</a></td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Vercel</td>
                  <td>Hosting en deployment</td>
                  <td><a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener noreferrer">vercel.com/legal/dpa</a></td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Anthropic</td>
                  <td>AI-verwerking voor coaching (geen training op jouw data)</td>
                  <td><a href="https://anthropic.com/legal" target="_blank" rel="noopener noreferrer">anthropic.com/legal</a></td>
                </tr>
                <tr>
                  <td style={{ color: '#f1f5f9' }}>Resend</td>
                  <td>Transactionele e-mails</td>
                  <td><a href="https://resend.com/legal/dpa" target="_blank" rel="noopener noreferrer">resend.com/legal/dpa</a></td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>
              Een deel van de verwerking vindt plaats bij partijen gevestigd buiten de EER (VS). ArnoBot waarborgt passende bescherming via Standard Contractual Clauses (SCC&apos;s) en sub-verwerkers met SOC 2 Type II certificering.
            </p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 6</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Bewaartermijnen</h2>
            <table>
              <thead>
                <tr><th>Categorie</th><th>Bewaartermijn</th></tr>
              </thead>
              <tbody>
                <tr><td style={{ color: '#f1f5f9' }}>Accountgegevens en profiel</td><td>Zolang het account actief is. Na beëindiging geanonimiseerd na 30 dagen, of eerder op verzoek via de accountpagina.</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Gesprekslogs</td><td>Worden geanonimiseerd bij anonimisering van het account.</td></tr>
                <tr><td style={{ color: '#f1f5f9' }}>Technische logs</td><td>Maximaal 90 dagen</td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 7</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Jouw rechten</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 20 }}>
              Je hebt het recht op inzage, rectificatie, verwijdering en overdraagbaarheid van jouw gegevens. Je kunt dit direct uitoefenen via jouw account:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {[
                'Data downloaden: Accountinstellingen → Jouw data',
                'Account verwijderen: Accountinstellingen → Account verwijderen',
                'Profiel aanpassen: via Profiel',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ color: '#f59e0b', flexShrink: 0 }}>·</span>
                  <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>{item}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>
              Voor overige verzoeken: <a href="mailto:privacy@arno.bot">privacy@arno.bot</a>. Verzoeken worden binnen 5 werkdagen beantwoord.
            </p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARTIKEL 8</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>Datalekken</h2>
            <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>
              In geval van een datalek word je zo spoedig mogelijk geïnformeerd, uiterlijk binnen 72 uur na ontdekking, via het e-mailadres dat aan jouw account is gekoppeld.
            </p>
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 32 }}>
            <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.9 }}>
              Laatste update: juni 2026 · Royal Dutch Sales, Lissabon, Portugal · <a href="mailto:privacy@arno.bot">privacy@arno.bot</a>
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
