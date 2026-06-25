import Link from 'next/link'

export default function VoorwaardenPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Barlow:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }

        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 16px 40px; display: flex; justify-content: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-links { display: flex; gap: 48px; align-items: center; }
        .nav-links a {
          color: #9ca3af; text-decoration: none;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 3px; transition: color 0.2s;
        }
        .nav-links a:hover { color: #f1f5f9; }
        .nav-cta { color: #f59e0b !important; }

        .page { padding-top: 80px; min-height: 100vh; }

        .hero {
          padding: 80px 60px 60px;
          border-bottom: 3px solid #f59e0b;
        }
        .hero-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(48px, 7vw, 96px); line-height: 0.9; color: #f1f5f9;
        }
        .hero-title span { color: #f59e0b; }
        .hero-meta { font-size: 12px; color: #4b5563; margin-top: 16px; }

        .body { max-width: 760px; margin: 0 auto; padding: 80px 40px 120px; }

        .section { margin-bottom: 56px; }
        .section-title {
          font-family: 'Bebas Neue', sans-serif; font-size: 22px;
          letter-spacing: 2px; color: #f59e0b; margin-bottom: 20px;
        }
        .section-num {
          font-family: 'Bebas Neue', sans-serif; font-size: 13px;
          letter-spacing: 2px; color: #4b5563; margin-bottom: 6px;
        }
        p { font-size: 13px; color: #9ca3af; line-height: 1.9; margin-bottom: 16px; }
        strong { color: #f1f5f9; }
        a { color: #f59e0b; text-decoration: none; }
        a:hover { text-decoration: underline; }

        .divider { height: 1px; background: #1e293b; margin: 40px 0; }

        footer {
          background: #0d1117; padding: 40px 60px;
          display: flex; justify-content: space-between; align-items: center;
          border-top: 1px solid #1f2937;
        }
        .footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #f59e0b; letter-spacing: 3px; }
        .footer-copy { font-size: 10px; color: #374151; }

        @media (max-width: 600px) {
          .hero { padding: 60px 24px 40px; }
          .body { padding: 60px 24px 80px; }
          footer { padding: 32px 24px; flex-direction: column; gap: 12px; }
        }
      `}</style>

      <nav className="site-nav">
        <div className="nav-links">
          <Link href="/">HOME</Link>
          <Link href="/bio">ARNO</Link>
          <a href="https://www.arno.bot/">BOT</a>
          <a href="https://salescanvas.app" target="_blank" rel="noopener noreferrer">CANVAS</a>
          <a href="https://arno.blog/subscribe" target="_blank" rel="noopener noreferrer" className="nav-cta">SUBSCRIBE</a>
        </div>
      </nav>

      <div className="page">
        <div className="hero">
          <h1 className="hero-title"><span>ALGEMENE</span> VOORWAARDEN</h1>
          <div className="hero-meta">Versie 2.0 · Juni 2026 · Royal Dutch Sales</div>
        </div>

        <div className="body">

          <div className="section">
            <div className="section-num">ARTIKEL 1</div>
            <div className="section-title">DEFINITIES</div>
            <p><strong>Royal Dutch Sales:</strong> de onderneming van Arno Diepeveen, gevestigd in Lissabon, Portugal, KvK-nummer [invullen], bereikbaar via arno@arno.bot.</p>
            <p><strong>ArnoBot:</strong> het digitale AI-coachingsplatform toegankelijk via arno.bot.</p>
            <p><strong>Gebruiker:</strong> de natuurlijke of rechtspersoon die zich aanmeldt voor en gebruik maakt van ArnoBot.</p>
            <p><strong>Abonnement:</strong> de overeenkomst tussen Royal Dutch Sales en de Gebruiker voor toegang tot ArnoBot tegen de overeengekomen vergoeding.</p>
          </div>

          <div className="divider" />

          <div className="section">
            <div className="section-num">ARTIKEL 2</div>
            <div className="section-title">TOEPASSELIJKHEID</div>
            <p>Deze algemene voorwaarden zijn van toepassing op alle aanbiedingen, offertes, overeenkomsten en diensten van Royal Dutch Sales, waaronder het gebruik van ArnoBot.</p>
            <p>Door gebruik te maken van ArnoBot of door akkoord te gaan bij aanmelding, aanvaardt de Gebruiker deze voorwaarden. Op de verwerking van persoonsgegevens is het <a href="/privacy">Privacybeleid</a> van toepassing.</p>
          </div>

          <div className="divider" />

          <div className="section">
            <div className="section-num">ARTIKEL 3</div>
            <div className="section-title">PROEFPERIODE</div>
            <p>Nieuwe gebruikers ontvangen een gratis proefperiode van <strong>30 dagen</strong> na activering van hun account. Gedurende deze periode is volledige functionaliteit beschikbaar.</p>
            <p>Na afloop van de proefperiode wordt de toegang geblokkeerd totdat een betaald abonnement is afgesloten. Er vindt geen automatische afschrijving plaats.</p>
            <p>Royal Dutch Sales behoudt zich het recht voor de proefperiode zonder opgave van reden te beëindigen of aan te passen.</p>
          </div>

          <div className="divider" />

          <div className="section">
            <div className="section-num">ARTIKEL 4</div>
            <div className="section-title">ABONNEMENT EN BETALING</div>
            <p>Na de proefperiode kan de Gebruiker een individueel abonnement of een teamabonnement afsluiten. De actuele prijzen staan vermeld op de website.</p>
            <p>Betaling geschiedt op basis van de overeengekomen betalingstermijn. Bij niet-tijdige betaling behoudt Royal Dutch Sales het recht de toegang te blokkeren.</p>
            <p>Het abonnement geldt per maand of per jaar, afhankelijk van de gekozen optie, en wordt automatisch verlengd tenzij tijdig opgezegd.</p>
          </div>

          <div className="divider" />

          <div className="section">
            <div className="section-num">ARTIKEL 5</div>
            <div className="section-title">GEBRUIK EN LICENTIE</div>
            <p>Royal Dutch Sales verleent de Gebruiker een niet-exclusieve, niet-overdraagbare licentie voor het gebruik van ArnoBot gedurende de looptijd van het abonnement.</p>
            <p>Het is niet toegestaan ArnoBot te gebruiken voor onrechtmatige doeleinden, de werking te verstoren, of toegang te verlenen aan derden buiten het afgesproken aantal gebruikers.</p>
          </div>

          <div className="divider" />

          <div className="section">
            <div className="section-num">ARTIKEL 6</div>
            <div className="section-title">INTELLECTUEEL EIGENDOM</div>
            <p>Alle rechten op ArnoBot, inclusief de software, vormgeving, teksten en methodologie, berusten bij Royal Dutch Sales.</p>
            <p>De door de Gebruiker ingevoerde data blijft eigendom van de Gebruiker. Royal Dutch Sales gebruikt deze data uitsluitend voor het leveren van de dienst.</p>
          </div>

          <div className="divider" />

          <div className="section">
            <div className="section-num">ARTIKEL 7</div>
            <div className="section-title">AANSPRAKELIJKHEID</div>
            <p>Royal Dutch Sales is niet aansprakelijk voor indirecte schade, gevolgschade of gederfde winst als gevolg van het gebruik van ArnoBot.</p>
            <p>De aansprakelijkheid van Royal Dutch Sales is in alle gevallen beperkt tot het bedrag dat de Gebruiker in de drie maanden voorafgaand aan de schade heeft betaald.</p>
          </div>

          <div className="divider" />

          <div className="section">
            <div className="section-num">ARTIKEL 8</div>
            <div className="section-title">OPZEGGING</div>
            <p>De Gebruiker kan het abonnement op elk moment opzeggen via de accountpagina onder Accountinstellingen. Opzegging per e-mail aan arno@arno.bot is eveneens mogelijk. De toegang blijft actief tot het einde van de lopende betaalperiode.</p>
            <p>Royal Dutch Sales kan het abonnement met onmiddellijke ingang beëindigen bij misbruik of overtreding van deze voorwaarden.</p>
          </div>

          <div className="divider" />

          <div className="section">
            <div className="section-num">ARTIKEL 9</div>
            <div className="section-title">OVERMACHT</div>
            <p>Royal Dutch Sales is niet gehouden tot nakoming van enige verplichting indien zij daartoe verhinderd is als gevolg van overmacht. Onder overmacht wordt onder meer verstaan: storingen bij externe dienstverleners (waaronder Anthropic, Supabase, Vercel of Clerk), internetstoringen, cyberaanvallen, overheidsmaatregelen en andere omstandigheden buiten de redelijke invloedssfeer van Royal Dutch Sales.</p>
            <p>In geval van overmacht worden de verplichtingen opgeschort zolang de overmachtsituatie voortduurt. Royal Dutch Sales stelt de Gebruiker zo spoedig mogelijk op de hoogte.</p>
          </div>

          <div className="divider" />

          <div className="section">
            <div className="section-num">ARTIKEL 10</div>
            <div className="section-title">TOEPASSELIJK RECHT</div>
            <p>Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in Nederland.</p>
          </div>

          <div className="divider" />

          <p style={{ fontSize: 11, color: '#4b5563' }}>
            Vragen over deze voorwaarden? Mail naar <a href="mailto:arno@arno.bot">arno@arno.bot</a>
          </p>

        </div>
      </div>

      <footer>
        <span className="footer-logo">Royal Dutch Sales</span>
        <span className="footer-copy">© 2025 Royal Dutch Sales. Alle rechten voorbehouden.</span>
      </footer>
    </>
  )
}
