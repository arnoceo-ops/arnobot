export const metadata = {
  title: 'Upgrade · Royal Dutch Sales',
}

export default function UpgradePage() {
  return (
    <main style={{ background: '#f5f0e8', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;700&display=swap');
        :root {
          --cream: #f5f0e8;
          --cream-dark: #ede7d8;
          --black: #0a0a0a;
          --orange: #EE7700;
          --orange-dark: #cc6600;
          --muted: #666;
          --body: #333;
        }
        .up-nav { background: var(--black); padding: 0 clamp(20px,5vw,48px); height: 64px; display: flex; align-items: center; justify-content: space-between; }
        .up-nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px; color: #f0ede6; text-decoration: none; }
        .up-nav-logo span { color: var(--orange); }
        .up-nav-back { font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 3px; color: #888; text-decoration: none; transition: color 0.2s; }
        .up-nav-back:hover { color: #f0ede6; }
        .upgrade-wrap { font-family: 'Barlow', sans-serif; color: var(--black); min-height: 100vh; padding: clamp(56px,8vw,96px) clamp(20px,5vw,48px); max-width: 1100px; margin: 0 auto; }
        .up-eyebrow { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 5px; color: var(--orange); margin-bottom: 10px; display: block; }
        .up-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(48px,7vw,80px); line-height: .95; color: var(--black); margin: 0 0 0.75rem; }
        .up-sub { font-size: 15px; color: var(--muted); max-width: 480px; line-height: 1.6; margin: 0 0 3rem; }
        .up-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 0; }
        .up-card { padding: 36px 32px; border: 2px solid var(--black); display: flex; flex-direction: column; position: relative; background: var(--cream-dark); }
        .up-card-dark { background: var(--black); }
        .up-badge { font-family: 'Bebas Neue', sans-serif; font-size: 10px; letter-spacing: 4px; background: var(--orange); color: #fff; padding: 5px 14px; position: absolute; top: -2px; right: -2px; }
        .up-plan { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px; color: var(--black); margin-bottom: 4px; }
        .up-card-dark .up-plan { color: #fff; }
        .up-for { font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 2px; color: var(--muted); margin-bottom: 20px; }
        .up-card-dark .up-for { color: #aaa; }
        .up-price { display: flex; align-items: baseline; gap: 8px; margin-bottom: 24px; }
        .up-currency { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: var(--black); line-height: 1; }
        .up-card-dark .up-currency { color: #fff; }
        .up-amount { font-family: 'Bebas Neue', sans-serif; font-size: 64px; line-height: 1; color: var(--black); }
        .up-card-dark .up-amount { color: #fff; }
        .up-divider { height: 1px; background: #ddd; margin: 0 0 24px; }
        .up-card-dark .up-divider { background: #1e1e1e; }
        .up-features { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; flex: 1; padding: 0; }
        .up-features li { font-size: 15px; color: var(--body); padding-left: 20px; position: relative; line-height: 1.5; }
        .up-features li::before { content: '→'; position: absolute; left: 0; color: var(--orange); font-size: 12px; }
        .up-card-dark .up-features li { color: #aaa; }
        .up-cta { display: block; background: var(--cream); color: var(--black); font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 3px; padding: 14px 24px; text-decoration: none; border: 2px solid var(--black); text-align: center; transition: all .15s; border-radius: 6px; }
        .up-cta:hover { background: var(--orange); color: #fff; border-color: var(--orange); }
        .up-cta-featured { background: var(--orange); color: #fff; border-color: var(--orange); }
        .up-cta-featured:hover { background: var(--orange-dark); border-color: var(--orange-dark); }
        .up-divider-section { display: flex; align-items: center; gap: 1.5rem; margin: 5rem 0; }
        .up-divider-section-line { flex: 1; border-top: 2px solid var(--black); }
        .up-divider-section-label { font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 0.2em; color: var(--black); white-space: nowrap; }
        .up-intro-block { border: 2px solid var(--black); background: var(--cream-dark); padding: 40px 40px 36px; margin-top: 2rem; margin-bottom: 4rem; display: flex; align-items: center; justify-content: space-between; gap: 2rem; }
        .up-intro-text { flex: 1; }
        .up-intro-eyebrow { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 5px; color: var(--orange); margin-bottom: 10px; display: block; }
        .up-intro-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(28px,4vw,40px); line-height: 1; color: var(--black); margin: 0 0 12px; }
        .up-intro-sub { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 420px; margin: 0; }
        .up-intro-cta { flex-shrink: 0; display: inline-block; background: var(--orange); color: #fff; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 3px; padding: 16px 32px; text-decoration: none; border: 2px solid var(--orange); text-align: center; transition: all .15s; border-radius: 6px; white-space: nowrap; }
        .up-intro-cta:hover { background: var(--orange-dark); border-color: var(--orange-dark); }
        @media (max-width: 640px) {
          .up-intro-block { flex-direction: column; align-items: flex-start; }
          .up-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <nav className="up-nav">
        <a href="/" className="up-nav-logo">ROYAL DUTCH <span>SALES.</span></a>
        <a href="/bot" className="up-nav-back">← TERUG NAAR ARNOBOT</a>
      </nav>

      <div className="upgrade-wrap">

        {/* ARNOLIVE */}
        <span className="up-eyebrow">Begeleiding</span>
        <h1 className="up-title">ARNOLIVE</h1>
        <p className="up-sub">Maandelijks 45 minuten. Cut the crap. Kort en krachtige feedback.</p>

        <div className="up-grid">
          <div className="up-card">
            <div className="up-plan">3 SESSIES</div>
            <div className="up-for">KWARTAAL</div>
            <div className="up-price">
              <span className="up-currency">€</span>
              <span className="up-amount">900</span>
            </div>
            <div className="up-divider" />
            <ul className="up-features">
              <li>Maandelijks 45 minuten met Arno</li>
              <li>Sessies via Proton Meet</li>
              <li>Direct feedback op jouw situatie</li>
              <li>Geen voorbereiding nodig</li>
              <li>Solo, met co-founder of hele team</li>
            </ul>
            <a href="mailto:arnolive@arno.bot?subject=ARNOLIVE%20Kwartaal%20%C2%B7%20aanmelding" className="up-cta">STARTEN →</a>
          </div>

          <div className="up-card up-card-dark">
            <div className="up-badge">MEEST GEKOZEN</div>
            <div className="up-plan">12 SESSIES</div>
            <div className="up-for">JAAR</div>
            <div className="up-price">
              <span className="up-currency">€</span>
              <span className="up-amount">2.700</span>
            </div>
            <div className="up-divider" />
            <ul className="up-features">
              <li>Maandelijks 45 minuten met Arno</li>
              <li>Sessies via Proton Meet</li>
              <li>Continuïteit: Arno kent jouw context</li>
              <li>Grip op het hele jaar</li>
              <li>Één kwartaal gratis</li>
            </ul>
            <a href="mailto:arnolive@arno.bot?subject=ARNOLIVE%20Jaar%20%C2%B7%20aanmelding" className="up-cta up-cta-featured">STARTEN →</a>
          </div>
        </div>

        <div className="up-intro-block">
          <div className="up-intro-text">
            <span className="up-intro-eyebrow">Gratis · 30 minuten</span>
            <h2 className="up-intro-title">Eerst kijken of je 't aandurft?</h2>
            <p className="up-intro-sub">Plan een kennismakingsgesprek met Arno. Geen pitch, geen druk. Gewoon kijken of het klikt en wat voor jou werkt.</p>
          </div>
          <a href="https://calendly.com/arnodiepeveen/30min" target="_blank" rel="noopener noreferrer" className="up-intro-cta">
            PLAN EEN GESPREK →
          </a>
        </div>

        <div className="up-divider-section">
          <div className="up-divider-section-line" />
          <span className="up-divider-section-label">NEXT LEVEL</span>
          <div className="up-divider-section-line" />
        </div>

        {/* ARNOPRIME */}
        <span className="up-eyebrow">Interventie</span>
        <h2 className="up-title">ARNOPRIME</h2>
        <p className="up-sub">Anderhalve dag op de hei. Jouw MT. Eén plan. Aligned.</p>

        <div className="up-grid">
          <div className="up-card">
            <div className="up-plan">1-2 PERSONEN</div>
            <div className="up-for">SOLO / CO-FOUNDERS</div>
            <div className="up-price">
              <span className="up-currency">€</span>
              <span className="up-amount">7.900</span>
            </div>
            <div className="up-divider" />
            <ul className="up-features">
              <li>1½ dag pressure cooker sessie buiten kantoor</li>
              <li>Voorbereiding op basis van jullie Sales Canvas</li>
              <li>Vertrek met een plan dat staat als een huis</li>
              <li>Optioneel: extra dag mogelijk</li>
              <li>All-in, overal in Europa</li>
            </ul>
            <a href="mailto:arnoprime@arno.bot?subject=ARNOPRIME%20Solo%20%C2%B7%20aanmelding" className="up-cta">NEEM CONTACT OP →</a>
          </div>

          <div className="up-card up-card-dark">
            <div className="up-badge">MANAGEMENT TEAM</div>
            <div className="up-plan">MT-SESSIE</div>
            <div className="up-for">HEEL HET MT</div>
            <div className="up-price">
              <span className="up-currency">€</span>
              <span className="up-amount">11.900</span>
            </div>
            <div className="up-divider" />
            <ul className="up-features">
              <li>1½ dag pressure cooker sessie buiten kantoor</li>
              <li>Voorgesprek met ieder MT-lid apart</li>
              <li>Output: strak plan. Ready. Set. Go.</li>
              <li>Optioneel: extra dag mogelijk</li>
              <li>All-in, overal in Europa</li>
            </ul>
            <a href="mailto:arnoprime@arno.bot?subject=ARNOPRIME%20MT-sessie%20%C2%B7%20aanmelding" className="up-cta up-cta-featured">NEEM CONTACT OP →</a>
          </div>
        </div>

      </div>
    </main>
  )
}
