import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import SiteFooter from '../SiteFooter'
import { SCENARIO_TEAM_PRIJS } from '@/lib/kostenTarieven'

export const metadata: Metadata = {
  title: 'ArnoBot Team',
  description: 'Geef elke verkoper een eigen AI-salescoach en jou als leidinggevende het overzicht: mindset, systeem en actie per persoon, waar iemand vastloopt, en een 1:1 die al klaarligt.',
  robots: { index: true, follow: true },
}

const TEAM_BASIS = SCENARIO_TEAM_PRIJS.basisMaandelijks
const TEAM_PERGEBRUIKER = SCENARIO_TEAM_PRIJS.perGebruikerMaandelijks

export default async function TeamPage() {
  const { userId } = await auth()
  const demoLink = process.env.ARNO_BOOKING_URL ?? null
  const demoHref = demoLink ?? 'mailto:arno@arno.bot?subject=Demo%20ArnoBot%20Team'
  const demoExtern = Boolean(demoLink)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;600&family=Figtree:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f8fafc; font-family: 'Figtree', sans-serif; font-size: 15px; }

        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 40px; height: 60px; display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-logo { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px; color: #f1f5f9; text-decoration: none; }
        .nav-logo span { color: #f59e0b; }
        .nav-spacer { flex: 1; }
        .nav-auth { display: flex; gap: 32px; align-items: center; }
        .nav-login { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 3px; color: #9ca3af; text-decoration: none; transition: color 0.2s; }
        .nav-login:hover { color: #f1f5f9; }

        .tm-wrap { max-width: 960px; margin: 0 auto; padding: 0 24px; }

        .tm-label {
          font-size: 13px; font-weight: 600; letter-spacing: 0.3em;
          text-transform: uppercase; color: #f59e0b; margin-bottom: 14px;
        }
        .tm-h2 {
          font-family: 'Oswald', sans-serif; font-size: clamp(26px, 3.4vw, 36px); font-weight: 600;
          text-transform: uppercase; line-height: 1.15; color: #f8fafc; text-wrap: balance;
        }
        .tm-lead { font-size: 17px; line-height: 1.7; color: #94a3b8; max-width: 60ch; }

        /* Hero */
        .tm-hero { padding: 150px 24px 72px; text-align: center; }
        .tm-hero h1 {
          font-family: 'Oswald', sans-serif; font-size: clamp(38px, 6vw, 60px); font-weight: 600;
          text-transform: uppercase; line-height: 1.05; color: #f8fafc; margin: 0 auto 20px;
          max-width: 16ch; text-wrap: balance;
        }
        .tm-hero p { font-size: 18px; line-height: 1.7; color: #94a3b8; max-width: 58ch; margin: 0 auto 32px; }

        .tm-cta-row { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
        .tm-btn {
          display: inline-flex; align-items: center; justify-content: center; text-decoration: none;
          border-radius: 6px; padding: 13px 28px; font-family: 'Oswald', sans-serif; font-size: 15px;
          font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; transition: transform 0.2s;
        }
        .tm-btn-primary { background: #f59e0b; color: #111827; box-shadow: 0 12px 24px rgba(245,158,11,0.25); }
        .tm-btn-primary:hover { transform: scale(1.04); }
        .tm-btn-ghost { background: transparent; color: #f59e0b; border: 1.5px solid #f59e0b; }
        .tm-btn-ghost:hover { background: rgba(245,158,11,0.08); }

        /* Sections */
        .tm-section { padding: 56px 0; border-top: 1px solid #1f2937; }
        .tm-section-narrow { max-width: 62ch; }

        /* Feature blocks: text + mockup */
        .tm-feature { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; padding: 44px 0; border-top: 1px solid #1f2937; }
        .tm-feature:nth-child(even) .tm-feature-visual { order: -1; }
        .tm-feature-text h3 {
          font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 600; text-transform: uppercase;
          color: #f8fafc; margin-bottom: 10px;
        }
        .tm-feature-text p { font-size: 15px; line-height: 1.7; color: #94a3b8; }

        /* Mockup card */
        .tm-mock { background: #1e293b; border: 1px solid #374151; border-radius: 12px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
        .tm-mock-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.25em; text-transform: uppercase; color: #f59e0b; margin-bottom: 14px; }
        .tm-mem-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .tm-mem { background: #111827; border: 1px solid #374151; border-radius: 8px; padding: 12px; }
        .tm-mem-name { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #f8fafc; letter-spacing: 0.04em; }
        .tm-mem-msa { font-family: 'Oswald', sans-serif; font-size: 26px; font-weight: 600; color: #f59e0b; line-height: 1.1; margin-top: 4px; }
        .tm-dots { display: flex; gap: 4px; margin-top: 8px; }
        .tm-dot { width: 8px; height: 8px; border-radius: 50%; }
        .tm-bar { margin-top: 16px; }
        .tm-bar-label { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
        .tm-bar-track { height: 8px; background: #111827; border-radius: 999px; overflow: hidden; }
        .tm-bar-fill { height: 100%; background: #f59e0b; }

        .tm-pillars { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .tm-pillar-name { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #94a3b8; }
        .tm-pillar-score { font-family: 'Oswald', sans-serif; font-size: 24px; font-weight: 600; color: #f8fafc; margin-top: 2px; }
        .tm-spark { margin-top: 14px; }

        .tm-quote { border-left: 3px solid #f59e0b; padding: 4px 0 4px 16px; }
        .tm-quote p { font-size: 14px; line-height: 1.7; color: #cbd5e1; }

        .tm-agenda-head { font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #f59e0b; margin-top: 12px; }
        .tm-agenda-head:first-child { margin-top: 0; }
        .tm-agenda-line { font-size: 13px; line-height: 1.6; color: #94a3b8; margin-top: 4px; }
        .tm-agenda-btn { margin-top: 16px; display: inline-block; background: #f59e0b; color: #111827; font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; padding: 8px 16px; border-radius: 999px; }

        /* Steps */
        .tm-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; counter-reset: step; }
        .tm-step { background: #1e293b; border: 1px solid #374151; border-radius: 12px; padding: 22px; }
        .tm-step-num { font-family: 'Oswald', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.1em; color: #f59e0b; }
        .tm-step p { font-size: 14px; line-height: 1.65; color: #94a3b8; margin-top: 10px; }

        /* Prijs */
        .tm-prijs { background: #1e293b; border: 1px solid rgba(245,158,11,0.35); border-radius: 12px; padding: 28px; margin-top: 24px; text-align: center; }
        .tm-prijs-num { font-family: 'Oswald', sans-serif; font-size: clamp(28px, 4vw, 40px); font-weight: 600; color: #f8fafc; }
        .tm-prijs-sub { font-size: 14px; color: #6b7280; margin-top: 6px; }
        .tm-prijs-links { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-top: 22px; }

        /* FAQ */
        .tm-faq { display: flex; flex-direction: column; gap: 4px; margin-top: 24px; }
        .tm-faq-item { border-top: 1px solid #1f2937; padding: 20px 0; }
        .tm-faq-item:last-child { border-bottom: 1px solid #1f2937; }
        .tm-faq-q { font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 600; text-transform: uppercase; color: #f8fafc; }
        .tm-faq-a { font-size: 14px; line-height: 1.7; color: #94a3b8; margin-top: 8px; max-width: 60ch; }

        .tm-final { text-align: center; padding: 64px 0 8px; }
        .tm-final .tm-h2 { margin-bottom: 14px; }
        .tm-final p { font-size: 16px; color: #94a3b8; max-width: 46ch; margin: 0 auto 28px; line-height: 1.7; }

        @media (max-width: 820px) {
          .tm-feature { grid-template-columns: 1fr; gap: 24px; }
          .tm-feature:nth-child(even) .tm-feature-visual { order: 0; }
          .tm-steps { grid-template-columns: 1fr; }
          .tm-hero { padding: 120px 24px 56px; }
        }
      `}</style>

      <nav className="site-nav">
        <Link href="/" className="nav-logo">ARNO<span>BOT.</span></Link>
        <div className="nav-spacer" />
        <div className="nav-auth">
          {userId
            ? <Link href="/bot" className="nav-login">MIJN BOT</Link>
            : <Link href="/sign-in" className="nav-login">LOGIN</Link>
          }
        </div>
      </nav>

      <section className="tm-hero">
        <p className="tm-label">ArnoBot Team</p>
        <h1>Je hele salesteam, scherp in beeld</h1>
        <p>
          Elke verkoper krijgt een eigen AI-salescoach. Jij krijgt het overzicht: waar staat
          iedereen op mindset, systeem en actie, wie loopt vast, en waar gaat je eerstvolgende
          1:1 over.
        </p>
        <div className="tm-cta-row">
          <a
            className="tm-btn tm-btn-primary"
            href={demoHref}
            {...(demoExtern ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            Plan een demo
          </a>
          <Link className="tm-btn tm-btn-ghost" href="/prijzen">Bekijk de prijzen</Link>
        </div>
      </section>

      <div className="tm-wrap">

        <section className="tm-section tm-section-narrow">
          <p className="tm-label">Het probleem</p>
          <h2 className="tm-h2">Je stuurt je team op onderbuikgevoel</h2>
          <p className="tm-lead" style={{ marginTop: 18 }}>
            Je voert 1:1&apos;s, maar je weet pas dat een verkoper vastzit als de cijfers
            tegenvallen. En je ziet geen patroon over je team heen: waar zit de gedeelde
            zwakte, wie groeit er echt, en waar levert coachen deze periode het meeste op.
          </p>
        </section>

        <section className="tm-section" style={{ paddingBottom: 8 }}>
          <p className="tm-label">Wat je als manager krijgt</p>
          <h2 className="tm-h2">Vier schermen, één beeld van je team</h2>
        </section>

        <div className="tm-feature">
          <div className="tm-feature-text">
            <h3>Teamoverzicht</h3>
            <p>
              De score van elke verkoper naast elkaar, plus de teamtrend over de maanden.
              Je ziet in vijf seconden wie aandacht nodig heeft.
            </p>
          </div>
          <div className="tm-feature-visual">
            <div className="tm-mock">
              <p className="tm-mock-eyebrow">Team Hippios</p>
              <div className="tm-mem-row">
                <div className="tm-mem">
                  <div className="tm-mem-name">Lisa</div>
                  <div className="tm-mem-msa">87</div>
                  <div className="tm-dots"><span className="tm-dot" style={{ background: '#f59e0b' }} /><span className="tm-dot" style={{ background: '#60a5fa' }} /><span className="tm-dot" style={{ background: '#4ade80' }} /></div>
                </div>
                <div className="tm-mem">
                  <div className="tm-mem-name">Alira</div>
                  <div className="tm-mem-msa">73</div>
                  <div className="tm-dots"><span className="tm-dot" style={{ background: '#f59e0b' }} /><span className="tm-dot" style={{ background: '#334155' }} /><span className="tm-dot" style={{ background: '#4ade80' }} /></div>
                </div>
                <div className="tm-mem">
                  <div className="tm-mem-name">Benny</div>
                  <div className="tm-mem-msa">93</div>
                  <div className="tm-dots"><span className="tm-dot" style={{ background: '#f59e0b' }} /><span className="tm-dot" style={{ background: '#60a5fa' }} /><span className="tm-dot" style={{ background: '#4ade80' }} /></div>
                </div>
              </div>
              <div className="tm-bar">
                <div className="tm-bar-label">Team MSA · 86 / 100</div>
                <div className="tm-bar-track"><div className="tm-bar-fill" style={{ width: '86%' }} /></div>
              </div>
            </div>
          </div>
        </div>

        <div className="tm-feature">
          <div className="tm-feature-text">
            <h3>Profiel per verkoper</h3>
            <p>
              Per persoon een diagnose op mindset, systeem en actie, met de ontwikkeling over
              tijd. Onderbouwd met wat er in de gesprekken gebeurt, niet met een vragenlijst.
            </p>
          </div>
          <div className="tm-feature-visual">
            <div className="tm-mock">
              <p className="tm-mock-eyebrow">Benny Verwaaijen</p>
              <div className="tm-pillars">
                <div><div className="tm-pillar-name">Mindset</div><div className="tm-pillar-score" style={{ color: '#f59e0b' }}>5</div></div>
                <div><div className="tm-pillar-name">Systeem</div><div className="tm-pillar-score" style={{ color: '#60a5fa' }}>5</div></div>
                <div><div className="tm-pillar-name">Actie</div><div className="tm-pillar-score" style={{ color: '#4ade80' }}>4</div></div>
              </div>
              <svg className="tm-spark" viewBox="0 0 240 56" width="100%" height="56" role="img" aria-label="Progressie over tijd">
                <polyline points="4,44 52,40 100,34 148,24 196,20 236,16" fill="none" stroke="#f59e0b" strokeWidth="2" />
                <polyline points="4,48 52,46 100,40 148,32 196,26 236,20" fill="none" stroke="#60a5fa" strokeWidth="2" />
                <polyline points="4,40 52,38 100,36 148,30 196,28 236,24" fill="none" stroke="#4ade80" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="tm-feature">
          <div className="tm-feature-text">
            <h3>Spotlight</h3>
            <p>
              ArnoBot leest alle gesprekken van je team en vertelt je waar de collectieve winst
              zit. Eén heldere prioriteit in plaats van tien losse signalen.
            </p>
          </div>
          <div className="tm-feature-visual">
            <div className="tm-mock">
              <p className="tm-mock-eyebrow">Spotlight</p>
              <div className="tm-quote">
                <p>
                  Je team leunt sterk op mindset maar blijft achter op systeem. Bij drie van je
                  vier verkopers zie je dezelfde ruis in de pipeline-opvolging. Daar zit deze
                  periode je grootste collectieve winst.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="tm-feature">
          <div className="tm-feature-text">
            <h3>1:1-voorbereiding</h3>
            <p>
              Voor elke verkoper een concept-agenda: wat gaat goed, wat is het aandachtspunt,
              wat adviseert Arno. Jij past aan en voert het gesprek.
            </p>
          </div>
          <div className="tm-feature-visual">
            <div className="tm-mock">
              <p className="tm-mock-eyebrow">1:1 met Benny</p>
              <p className="tm-agenda-head">Wat gaat goed</p>
              <p className="tm-agenda-line">Je hebt de beslisser dit keer al in het tweede gesprek in kaart gebracht.</p>
              <p className="tm-agenda-head">Aandachtspunt</p>
              <p className="tm-agenda-line">De vraag is of dat standhoudt als een traject stroef loopt.</p>
              <p className="tm-agenda-head">Arno adviseert</p>
              <p className="tm-agenda-line">Pak een recent moeilijk traject en zoek het moment waarop je eerder had kunnen escaleren.</p>
              <span className="tm-agenda-btn">Bereid 1:1 voor</span>
            </div>
          </div>
        </div>

        <section className="tm-section">
          <p className="tm-label">Hoe het werkt</p>
          <h2 className="tm-h2">Opgezet in een middag, geen extra werk voor je verkopers</h2>
          <div className="tm-steps">
            <div className="tm-step">
              <div className="tm-step-num">Stap 1</div>
              <p>Je maakt een team aan en nodigt je verkopers uit met een link.</p>
            </div>
            <div className="tm-step">
              <div className="tm-step-num">Stap 2</div>
              <p>Elke verkoper krijgt zijn eigen volledige ArnoBot: sparren, coaching, gespreksanalyses.</p>
            </div>
            <div className="tm-step">
              <div className="tm-step-num">Stap 3</div>
              <p>Jij ziet het dashboard. Geen invulformulieren, geen extra taken voor je team.</p>
            </div>
          </div>
        </section>

        <section className="tm-section tm-section-narrow">
          <p className="tm-label">Voor je verkopers</p>
          <h2 className="tm-h2">Geen kaal dashboard, het hele product</h2>
          <p className="tm-lead" style={{ marginTop: 18 }}>
            Elke verkoper in je team krijgt de volledige Pro-versie van ArnoBot: 24/7 sparren,
            oefengesprekken tegen lastige types, een analyse van elk verkoopgesprek, en coaching
            op mindset, systeem en actie. Het dashboard is jouw laag daarbovenop.
          </p>
        </section>

        <section className="tm-section tm-section-narrow">
          <p className="tm-label">Wat je wel en niet ziet</p>
          <h2 className="tm-h2">De synthese, nooit de ruwe gesprekken</h2>
          <p className="tm-lead" style={{ marginTop: 18 }}>
            Je ziet de coaching-diagnose en de scores van je verkopers, plus de 1:1&apos;s die
            je zelf voert. Je ziet nooit de gesprekken die een verkoper met ArnoBot voert.
            Verkopers zien elkaars data niet.
          </p>
        </section>

        <section className="tm-section">
          <p className="tm-label">Prijs</p>
          <h2 className="tm-h2">Eén platformtarief, plus per verkoper</h2>
          <div className="tm-prijs">
            <div className="tm-prijs-num">&euro; {TEAM_BASIS} / maand + &euro; {TEAM_PERGEBRUIKER} per verkoper</div>
            <p className="tm-prijs-sub">Vanaf 3 verkopers. Jaarlijks vooruitbetaald is er ongeveer 20% korting. Exclusief btw.</p>
            <div className="tm-prijs-links">
              <Link className="tm-btn tm-btn-ghost" href="/prijzen">Volledige prijzen</Link>
              <Link className="tm-btn tm-btn-primary" href="/team/aanvragen">Direct aanvragen</Link>
            </div>
          </div>
        </section>

        <section className="tm-section">
          <p className="tm-label">Vragen</p>
          <h2 className="tm-h2">Kort antwoord</h2>
          <div className="tm-faq">
            <div className="tm-faq-item">
              <p className="tm-faq-q">Wat is het minimum?</p>
              <p className="tm-faq-a">Drie verkopers, inclusief jezelf.</p>
            </div>
            <div className="tm-faq-item">
              <p className="tm-faq-q">Kan ik het eerst zien zonder mijn team erbij?</p>
              <p className="tm-faq-a">Ja. In de demo lopen we samen door een ingericht voorbeeldteam. Je hoeft niets voor te bereiden.</p>
            </div>
            <div className="tm-faq-item">
              <p className="tm-faq-q">Zien mijn verkopers elkaars scores?</p>
              <p className="tm-faq-a">Nee. Een verkoper ziet alleen zijn eigen ArnoBot. Jij ziet het teamoverzicht.</p>
            </div>
            <div className="tm-faq-item">
              <p className="tm-faq-q">Kan ik maandelijks opzeggen?</p>
              <p className="tm-faq-a">Ja, bij de maandelijkse variant. De jaarlijkse variant loopt per jaar.</p>
            </div>
          </div>
        </section>

        <section className="tm-final">
          <h2 className="tm-h2">Zie het op je eigen scherm</h2>
          <p>Twintig minuten, jouw vragen, een ingericht voorbeeldteam. Daarna weet je of het bij je team past.</p>
          <div className="tm-cta-row">
            <a
              className="tm-btn tm-btn-primary"
              href={demoHref}
              {...(demoExtern ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              Plan een demo
            </a>
          </div>
        </section>

      </div>

      <SiteFooter />
    </>
  )
}
