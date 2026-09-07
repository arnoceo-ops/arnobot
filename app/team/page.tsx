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
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;600&family=Figtree:wght@400;500&family=Space+Mono:wght@400;700&display=swap');

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

        .tm-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

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
        .tm-section { padding: 56px 0; border-top: 1px solid #1f2937; text-align: center; }
        .tm-section-narrow { max-width: 62ch; margin-left: auto; margin-right: auto; }
        .tm-section .tm-lead { margin-left: auto; margin-right: auto; }

        /* Held-productshot onder de hero (Linear/Vercel-patroon: koptekst, dan het product) */
        .tm-heroshot { max-width: 1040px; margin: 8px auto 0; padding: 0 24px; }
        .tm-heroshot-frame { position: relative; border-radius: 14px; }
        .tm-heroshot-frame::before {
          content: ''; position: absolute; left: 50%; top: -6%; width: 78%; height: 60%;
          transform: translateX(-50%); background: #f59e0b; filter: blur(120px); opacity: 0.14; z-index: 0;
        }
        .tm-heroshot img {
          position: relative; z-index: 1; display: block; width: 100%; height: auto;
          border-radius: 14px; border: 1px solid #374151;
          box-shadow: 0 40px 100px rgba(0,0,0,0.5);
        }
        .tm-heroshot figcaption { margin-top: 16px; text-align: center; font-size: 13px; color: #6b7280; }

        /* Feature-secties: korte tekst naast een herbouwd productfragment (Stripe/Attio-patroon) */
        .tm-feat { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; padding: 52px 0; border-top: 1px solid #1f2937; }
        .tm-feat-flip .tm-feat-frag { order: -1; }
        .tm-feat-text h3 {
          font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 600; text-transform: uppercase;
          color: #f8fafc; margin-bottom: 12px;
        }
        .tm-feat-text p { font-size: 15px; line-height: 1.7; color: #94a3b8; }

        /* Productfragment in de dashboard-stijl (Space Mono, amber accent, elevated card) */
        .tm-frag {
          position: relative; overflow: hidden;
          background: #1f2937; border: 1px solid #374151; border-left: 3px solid #f59e0b;
          border-radius: 6px; padding: 24px 26px 40px;
          font-family: 'Space Mono', monospace;
          box-shadow: 0 20px 50px rgba(0,0,0,0.35);
        }
        .tm-frag::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 72px;
          background: linear-gradient(to bottom, rgba(31,41,55,0), #1f2937);
        }
        .tm-frag-label { font-size: 12px; letter-spacing: 0.25em; color: #f59e0b; }
        .tm-frag-h { font-size: 12px; letter-spacing: 0.22em; color: #f1f5f9; margin: 20px 0 7px; }
        .tm-frag-p { font-size: 13px; line-height: 1.85; color: #9ca3af; }
        .tm-frag-scores { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-top: 16px; }
        .tm-frag-score-name { font-size: 10px; letter-spacing: 0.18em; color: #94a3b8; }
        .tm-frag-score-bar { height: 5px; border-radius: 999px; background: #111827; margin: 7px 0; overflow: hidden; }
        .tm-frag-score-bar i { display: block; height: 100%; }
        .tm-frag-score-num { font-size: 20px; font-weight: 700; line-height: 1; }
        .tm-frag-pill {
          position: relative; z-index: 2; display: inline-block; margin-top: 22px;
          background: #f59e0b; color: #111827; font-size: 11px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; padding: 8px 16px; border-radius: 999px;
        }

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
        .tm-faq-a { font-size: 14px; line-height: 1.7; color: #94a3b8; margin: 8px auto 0; max-width: 60ch; }

        .tm-final { text-align: center; padding: 64px 0 8px; }
        .tm-final .tm-h2 { margin-bottom: 14px; }
        .tm-final p { font-size: 16px; color: #94a3b8; max-width: 46ch; margin: 0 auto 28px; line-height: 1.7; }

        @media (max-width: 820px) {
          .tm-feat { grid-template-columns: 1fr; gap: 24px; padding: 40px 0; }
          .tm-feat-flip .tm-feat-frag { order: 0; }
          .tm-steps { grid-template-columns: 1fr; }
          .tm-hero { padding: 120px 24px 48px; }
          .tm-heroshot { margin-top: 4px; }
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

      <figure className="tm-heroshot">
        <div className="tm-heroshot-frame">
          <img src="/team/overzicht.jpg" width="1600" height="996" alt="Het teamdashboard: de score van elke verkoper naast elkaar met de teamtrend over de maanden" />
        </div>
        <figcaption>Je hele team in één scherm, bijgewerkt na elk gesprek dat je verkopers voeren.</figcaption>
      </figure>

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

        <section className="tm-section" style={{ paddingBottom: 0, borderBottom: 'none' }}>
          <p className="tm-label">Wat je als manager krijgt</p>
          <h2 className="tm-h2">Van overzicht naar het volgende gesprek</h2>
          <p className="tm-lead" style={{ marginTop: 18 }}>
            Het teamoverzicht laat zien waar iedereen staat. Deze twee schermen vertellen je
            wat je ermee doet.
          </p>
        </section>

        <div className="tm-feat tm-feat-flip">
          <div className="tm-feat-text">
            <h3>Profiel per verkoper</h3>
            <p>
              Je ziet welke verkoper achterloopt op systeem en welke op mindset, en of het
              beter wordt of niet. Niet uit een vragenlijst die iedereen invult zoals hij
              denkt dat het hoort, maar uit wat er in de gesprekken zelf gebeurt.
            </p>
            <p style={{ marginTop: 14 }}>
              De diagnose waar je normaal maanden meelopen voor nodig hebt, ligt er na de
              eerste week.
            </p>
          </div>
          <div className="tm-feat-frag">
            <div className="tm-frag">
              <p className="tm-frag-label">BENNY VERWAAIJEN</p>
              <div className="tm-frag-scores">
                <div>
                  <p className="tm-frag-score-name">MINDSET</p>
                  <div className="tm-frag-score-bar"><i style={{ width: '100%', background: '#f59e0b' }} /></div>
                  <span className="tm-frag-score-num" style={{ color: '#f59e0b' }}>5</span>
                </div>
                <div>
                  <p className="tm-frag-score-name">SYSTEEM</p>
                  <div className="tm-frag-score-bar"><i style={{ width: '100%', background: '#60a5fa' }} /></div>
                  <span className="tm-frag-score-num" style={{ color: '#60a5fa' }}>5</span>
                </div>
                <div>
                  <p className="tm-frag-score-name">ACTIE</p>
                  <div className="tm-frag-score-bar"><i style={{ width: '80%', background: '#4ade80' }} /></div>
                  <span className="tm-frag-score-num" style={{ color: '#4ade80' }}>4</span>
                </div>
              </div>
              <p className="tm-frag-h">SYSTEEM</p>
              <p className="tm-frag-p">
                Pipeline-opvolging is scherper geworden. Beslissers worden nu vroeg in kaart
                gebracht in plaats van halverwege ontdekt.
              </p>
              <p className="tm-frag-h">ACTIE</p>
              <p className="tm-frag-p">
                Proactief en resultaatgericht. Nog steeds de neiging om te duwen als een traject
                stilligt, waar afwachten soms sterker is.
              </p>
            </div>
          </div>
        </div>

        <div className="tm-feat">
          <div className="tm-feat-text">
            <h3>1:1-voorbereiding</h3>
            <p>
              Je opent je 1:1 niet meer met "en, hoe gaat het". Voor elke verkoper ligt er een
              agenda klaar: wat er goed gaat, het ene punt dat er nu toe doet, en de vragen die
              Arno zou stellen.
            </p>
            <p style={{ marginTop: 14 }}>
              Jij leest het door, past aan waar je iets beter weet, en voert een gesprek dat
              ergens over gaat.
            </p>
          </div>
          <div className="tm-feat-frag">
            <div className="tm-frag">
              <p className="tm-frag-label">1:1 AGENDA</p>
              <p className="tm-frag-h">WAT GAAT GOED</p>
              <p className="tm-frag-p">
                Je hebt recent een duidelijke stap gemaakt in het stellen van directe
                afsluitvragen. De deal die drie maanden vastzat sloot je af door scherper door
                te vragen.
              </p>
              <p className="tm-frag-h">AANDACHTSPUNT</p>
              <p className="tm-frag-p">
                Je pipeline-opvolging mist nog vaste structuur, en dat kost je klanten die je
                goed hebt bereikt.
              </p>
              <p className="tm-frag-h">ARNO ADVISEERT</p>
              <p className="tm-frag-p">
                Vraag Alira in dit gesprek wat ze zelf zag voordat ze die afsluitvraag stelde,
                en wat er anders was aan die twee gesprekken.
              </p>
              <span className="tm-frag-pill">Bereid 1:1 voor</span>
            </div>
          </div>
        </div>

        <section className="tm-section">
          <p className="tm-label">Hoe het werkt</p>
          <h2 className="tm-h2">Meteen aan de gang. Opgezet binnen een uur.</h2>
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
            op mindset, systeem en actie. Het management dashboard is jouw laag daarbovenop.
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
