import PublicNav from '@/app/components/PublicNav'

export const metadata = {
  title: 'Algemene voorwaarden: ArnoBot',
  robots: 'noindex',
}

export default function VoorwaardenPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        a { color: #f59e0b; text-decoration: none; }
        a:hover { text-decoration: underline; }
      `}</style>

      <PublicNav />

      <div style={{ minHeight: '100vh', background: '#111827' }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>

          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1.0, marginBottom: 16 }}>ALGEMENE VOORWAARDEN.</h1>
          <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 48 }}>
            Versie 2.0 · Juni 2026 · Royal Dutch Sales, Lissabon, Portugal.
          </p>

          {[
            {
              num: 'ARTIKEL 1', title: 'Definities',
              content: [
                <p key="a" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}><strong style={{ color: '#f1f5f9' }}>Royal Dutch Sales:</strong> gevestigd in Lissabon, Portugal, bereikbaar via <a href="mailto:hq@arno.bot">hq@arno.bot</a>.</p>,
                <p key="b" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}><strong style={{ color: '#f1f5f9' }}>ArnoBot:</strong> het digitale AI-coachingsplatform toegankelijk via arno.bot.</p>,
                <p key="c" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}><strong style={{ color: '#f1f5f9' }}>Gebruiker:</strong> de natuurlijke of rechtspersoon die zich aanmeldt voor en gebruik maakt van ArnoBot.</p>,
                <p key="d" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}><strong style={{ color: '#f1f5f9' }}>Abonnement:</strong> de overeenkomst tussen Royal Dutch Sales en de Gebruiker voor toegang tot ArnoBot tegen de overeengekomen vergoeding.</p>,
              ],
            },
            {
              num: 'ARTIKEL 2', title: 'Toepasselijkheid',
              content: [
                <p key="a" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Deze algemene voorwaarden zijn van toepassing op alle aanbiedingen, offertes, overeenkomsten en diensten van Royal Dutch Sales, waaronder het gebruik van ArnoBot.</p>,
                <p key="b" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Door gebruik te maken van ArnoBot aanvaardt de Gebruiker deze voorwaarden. Op de verwerking van persoonsgegevens is het <a href="/privacy">Privacybeleid</a> van toepassing.</p>,
              ],
            },
            {
              num: 'ARTIKEL 3', title: 'Proefperiode',
              content: [
                <p key="a" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Nieuwe gebruikers ontvangen een gratis proefperiode van <strong style={{ color: '#f1f5f9' }}>30 dagen</strong> na activering van hun account. Gedurende deze periode is volledige functionaliteit beschikbaar.</p>,
                <p key="b" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Na afloop van de proefperiode wordt de toegang geblokkeerd totdat een betaald abonnement is afgesloten. Er vindt geen automatische afschrijving plaats.</p>,
                <p key="c" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Royal Dutch Sales behoudt zich het recht voor de proefperiode zonder opgave van reden te beëindigen of aan te passen.</p>,
              ],
            },
            {
              num: 'ARTIKEL 4', title: 'Abonnement en betaling',
              content: [
                <p key="a" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Na de proefperiode kan de Gebruiker een individueel abonnement of een teamabonnement afsluiten. De actuele prijzen staan vermeld op de website.</p>,
                <p key="b" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Betaling geschiedt op basis van de overeengekomen betalingstermijn. Bij niet-tijdige betaling behoudt Royal Dutch Sales het recht de toegang te blokkeren.</p>,
                <p key="c" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Het abonnement geldt per maand of per jaar, afhankelijk van de gekozen optie, en wordt automatisch verlengd tenzij tijdig opgezegd.</p>,
              ],
            },
            {
              num: 'ARTIKEL 5', title: 'Gebruik en licentie',
              content: [
                <p key="a" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Royal Dutch Sales verleent de Gebruiker een niet-exclusieve, niet-overdraagbare licentie voor het gebruik van ArnoBot gedurende de looptijd van het abonnement of de proefperiode.</p>,
                <p key="b" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Het is niet toegestaan ArnoBot te gebruiken voor onrechtmatige doeleinden, de werking te verstoren, of toegang te verlenen aan derden buiten het afgesproken aantal gebruikers.</p>,
              ],
            },
            {
              num: 'ARTIKEL 6', title: 'Intellectueel eigendom',
              content: [
                <p key="a" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Alle rechten op ArnoBot, inclusief de software, vormgeving, teksten en methodologie, berusten bij Royal Dutch Sales.</p>,
                <p key="b" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>De door de Gebruiker ingevoerde data blijft eigendom van de Gebruiker. Royal Dutch Sales gebruikt deze data uitsluitend voor het leveren van de dienst.</p>,
                <p key="c" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>De Gebruiker heeft het recht te verzoeken zijn persoonsgegevens te verwijderen via de accountpagina. Wordt geen verzoek ingediend, dan worden persoonsgegevens uiterlijk 30 dagen na beëindiging van het account verwijderd en worden gespreksgegevens geanonimiseerd.</p>,
              ],
            },
            {
              num: 'ARTIKEL 7', title: 'Opzegging',
              content: [
                <p key="a" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>De Gebruiker kan het abonnement opzeggen via de accountpagina of per e-mail aan <a href="mailto:cancel@arno.bot">cancel@arno.bot</a>.</p>,
                <p key="b" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Voor maandelijks abonnement bedraagt de opzegtermijn één kalendermaand. Opzegging dient te worden ingediend vóór de eerste dag van de volgende kalendermaand en gaat in op de eerste dag van de maand daarna. De Gebruiker is over die tussenliggende maand de volledige abonnementsprijs verschuldigd.</p>,
                <p key="b2" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Voor jaarlijks abonnement geldt een opzegtermijn van twee maanden vóór de verlengingsdatum. Wordt niet tijdig opgezegd, dan wordt het abonnement automatisch verlengd voor één jaar.</p>,
                <p key="c" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Royal Dutch Sales kan het abonnement met onmiddellijke ingang beëindigen bij misbruik of overtreding van deze voorwaarden.</p>,
              ],
            },
            {
              num: 'ARTIKEL 8', title: 'Overmacht',
              content: [
                <p key="a" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Royal Dutch Sales is niet gehouden tot nakoming van enige verplichting indien zij daartoe verhinderd is als gevolg van overmacht. Hieronder valt onder meer: storingen bij externe dienstverleners (waaronder Anthropic, Supabase, Vercel of Clerk), internetstoringen, cyberaanvallen en overheidsmaatregelen.</p>,
                <p key="b" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>In geval van overmacht worden de verplichtingen opgeschort zolang de situatie voortduurt. Royal Dutch Sales stelt de Gebruiker zo spoedig mogelijk op de hoogte.</p>,
              ],
            },
            {
              num: 'ARTIKEL 9', title: 'Wijziging van de voorwaarden',
              content: [
                <p key="a" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Royal Dutch Sales behoudt zich het recht voor deze voorwaarden te wijzigen. Wijzigingen worden minimaal 14 dagen van tevoren per e-mail aangekondigd aan actieve gebruikers.</p>,
                <p key="b" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 12 }}>Indien een wijziging nadelig is voor de Gebruiker, heeft de Gebruiker het recht de overeenkomst zonder opgaaf van reden te beëindigen, met ingang van de datum waarop de gewijzigde voorwaarden van kracht worden.</p>,
                <p key="c" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Voortzetting van het gebruik van ArnoBot na de ingangsdatum van een wijziging geldt als aanvaarding van de nieuwe voorwaarden.</p>,
              ],
            },
            {
              num: 'ARTIKEL 10', title: 'Toepasselijk recht',
              content: [
                <p key="a" style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in Nederland.</p>,
              ],
            },
          ].map((article, i) => (
            <div key={article.num} style={{ borderTop: i === 0 ? '3px solid #f59e0b' : '1px solid #374151', paddingTop: 32, marginBottom: 48 }}>
              <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>{article.num}</p>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, color: '#f1f5f9', marginBottom: 20 }}>{article.title}</h2>
              {article.content}
            </div>
          ))}

        </div>
      </div>
    </>
  )
}
