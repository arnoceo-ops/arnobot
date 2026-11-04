import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import SiteFooter from '../SiteFooter'

export const metadata: Metadata = {
  title: 'ArnoBot Team',
  description: 'Geef elke verkoper een eigen AI-salescoach en jou als leidinggevende het overzicht: mindset, systeem en actie per persoon, waar iemand vastloopt, en een 1:1 die al klaarligt.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.arno.bot/team' },
  openGraph: {
    title: 'ArnoBot Team',
    description: 'Geef elke verkoper een eigen AI-salescoach en jou als leidinggevende het overzicht: mindset, systeem en actie per persoon.',
    url: 'https://www.arno.bot/team',
    siteName: 'ArnoBot',
    locale: 'nl_NL',
    type: 'website',
    images: '/opengraph-image',
  },
  twitter: { card: 'summary_large_image' },
}

export default async function TeamPage() {
  const { userId } = await auth()
  const demoLink = process.env.ARNO_BOOKING_URL ?? null
  const demoHref = demoLink ?? 'mailto:arno@arno.bot?subject=Demo%20ArnoBot%20Team'
  const demoExtern = Boolean(demoLink)

  return (
    <>
      <style>{`

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

        .tm-backlink { text-align: center; margin: -32px 0 40px; font-size: 15px; }
        .tm-backlink a { color: #f59e0b; text-decoration: underline; text-underline-offset: 3px; }
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

        .tm-navdemo {
          font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
          color: #f59e0b; border: 1.5px solid #f59e0b; border-radius: 6px; padding: 8px 18px; text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        .tm-navdemo:hover { background: #f59e0b; color: #111827; }

        /* Steps */
        .tm-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; counter-reset: step; }
        .tm-step { background: #1e293b; border: 1px solid #374151; border-radius: 12px; padding: 28px 24px; text-align: center; }
        .tm-step-num { font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 600; letter-spacing: 0.1em; color: #f59e0b; }
        .tm-step p { font-size: 16px; line-height: 1.65; color: #cbd5e1; margin-top: 12px; }

        /* Zes dingen die geen manager kan: twee kolommen, rustig en strak */
        .tm-big-list {
          max-width: 1040px; margin: 40px auto 0; padding: 0 24px;
          display: grid; grid-template-columns: 1fr 1fr; column-gap: 72px;
        }
        .tm-big { padding: 40px 0 52px; border-top: 1px solid #2a3547; text-align: left; }
        .tm-big-num { font-family: 'Oswald', sans-serif; font-size: 34px; font-weight: 600; line-height: 1; letter-spacing: 0.06em; color: #f59e0b; margin-bottom: 14px; }
        .tm-big h3 {
          font-family: 'Oswald', sans-serif; font-size: 30px; font-weight: 600; text-transform: uppercase;
          color: #f8fafc; line-height: 1.12; letter-spacing: 0.01em; margin-bottom: 14px;
        }
        .tm-big p { font-size: 16px; line-height: 1.75; color: #a3b1c6; max-width: 42ch; }

        .tm-seven {
          width: calc(100% - 48px); max-width: 992px; margin: 56px auto 24px; padding: 72px 32px; text-align: center;
          background: linear-gradient(180deg, rgba(245,158,11,0.13), rgba(245,158,11,0.05));
          border: 1px solid rgba(245,158,11,0.4); border-radius: 16px;
        }
        .tm-seven .tm-h2 { font-size: clamp(32px, 4.4vw, 52px); line-height: 1.05; }
        .tm-seven p:not(.tm-label) { font-size: 18px; line-height: 1.7; color: #cbd5e1; max-width: 46ch; margin: 22px auto 0; }

        /* Prijs */

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
          .tm-steps { grid-template-columns: 1fr; }
          .tm-big-list { grid-template-columns: 1fr; }
          .tm-seven { padding: 48px 20px; }
          .tm-hero { padding: 120px 24px 48px; }
          .tm-heroshot { margin-top: 4px; }
        }
      `}</style>

      <nav className="site-nav">
        <Link href="/" className="nav-logo">ARNO<span>BOT.</span></Link>
        <div className="nav-spacer" />
        <div className="nav-auth" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {userId && <Link href="/bot" className="nav-login">MIJN BOT</Link>}
          <a
            className="tm-navdemo"
            href={demoHref}
            {...(demoExtern ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            Plan een demo
          </a>
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
        </div>
      </section>

      <p className="tm-backlink"><Link href="/">Wat je verkopers krijgen</Link></p>

      <figure className="tm-heroshot">
        <div className="tm-heroshot-frame">
          <img src="/team/overzicht.jpg" width="1566" height="873" alt="Het teamdashboard: de score van elke verkoper naast elkaar met de teamtrend over de maanden" />
        </div>
        <figcaption>Je hele team in één scherm, bijgewerkt na elk gesprek dat je verkopers voeren.</figcaption>
      </figure>

      <div className="tm-wrap">

        <section className="tm-section tm-section-narrow" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <p className="tm-label">Wat geen manager kan</p>
          <h2 className="tm-h2">Ook de beste manager kan dit niet alleen</h2>
          <p className="tm-lead" style={{ marginTop: 18 }}>
            Niet door gebrek aan inzet, maar omdat er maar één van hem is. Daar vult ArnoBot aan.
          </p>
        </section>

      </div>

        <div className="tm-big-list">
          <div className="tm-big">
            <div className="tm-big-num">01</div>
            <div>
              <h3>Overal tegelijk</h3>
              <p>Jij coacht één verkoper per keer. ArnoBot is er voor iedereen tegelijk: vlak voor een lastig gesprek, laat op de avond, in het weekend na een verloren deal. Precies op het moment dat coaching het meeste oplevert, en jij er niet bent.</p>
            </div>
          </div>
          <div className="tm-big">
            <div className="tm-big-num">02</div>
            <div>
              <h3>Nooit een slechte dag</h3>
              <p>Geen vermoeidheid, geen vakantie, geen druk. Elke verkoper krijgt altijd dezelfde volle aandacht, ook nummer twintig op de lijst, ook op vrijdagmiddag na een zware week.</p>
            </div>
          </div>
          <div className="tm-big">
            <div className="tm-big-num">03</div>
            <div>
              <h3>Perfect geheugen</h3>
              <p>Wat een verkoper drie maanden geleden beloofde, legt ArnoBot naast wat hij vandaag zegt. Elk patroon, elke afspraak, elke terugval. Voor elk teamlid tegelijk, zonder dat jij iets hoeft bij te houden.</p>
            </div>
          </div>
          <div className="tm-big">
            <div className="tm-big-num">04</div>
            <div>
              <h3>Geen politiek en geen favoriet</h3>
              <p>Feedback van een manager wordt altijd een beetje gekleurd door de relatie. ArnoBot geeft iedereen dezelfde eerlijke spiegel, gebaseerd op iemands eigen patronen en niet op sympathie.</p>
            </div>
          </div>
          <div className="tm-big">
            <div className="tm-big-num">05</div>
            <div>
              <h3>Eerlijkheid die jij nooit krijgt</h3>
              <p>Niemand geeft graag aan zijn baas toe dat hij onzeker is of een deal laat liggen. Aan ArnoBot wel, want jij ziet de gesprekken nooit, alleen de synthese. Daardoor hoor je eindelijk wat er echt speelt.</p>
            </div>
          </div>
          <div className="tm-big">
            <div className="tm-big-num">06</div>
            <div>
              <h3>Dezelfde kwaliteit, hoe groot het team ook is</h3>
              <p>Hoe meer verkopers, hoe minder tijd jij per verkoper hebt. Met ArnoBot krijgt verkoper twintig dezelfde coaching als verkoper één. Je team groeit, je coachingkwaliteit niet.</p>
            </div>
          </div>
        </div>

        <section className="tm-seven">
          <p className="tm-label">En dan jijzelf</p>
          <h2 className="tm-h2">Wie coacht eigenlijk jou?</h2>
          <p>
            Jij coacht je mensen. Maar wie kijkt naar hoe jij dat doet? Wie helpt jou met je
            1:1&apos;s, met je blinde vlekken, met wat je team van jou nodig heeft? ArnoBot
            coacht ook jou: eerlijk, zonder agenda, op elk moment.
          </p>
        </section>

      <div className="tm-wrap">
        <section className="tm-section">
          <p className="tm-label">Hoe het werkt</p>
          <h2 className="tm-h2">Zo werkt het</h2>
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
              <p className="tm-faq-q">Zie ik de gesprekken van mijn verkopers?</p>
              <p className="tm-faq-a">Nee. Je ziet de coaching-diagnose, de scores en de 1:1&apos;s die je zelf voert, nooit de gesprekken die een verkoper met ArnoBot voert.</p>
            </div>
            <div className="tm-faq-item">
              <p className="tm-faq-q">Krijgen mijn verkopers alleen een dashboard?</p>
              <p className="tm-faq-a">Nee, elke verkoper krijgt de volledige Pro-versie van ArnoBot: sparren, oefengesprekken, gespreksanalyses en coaching. Het dashboard is jouw laag daarbovenop.</p>
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
          <p>
            Twintig minuten, jouw vragen, een ingericht voorbeeldteam. Of sla de demo over en
            vraag direct aan, daar zie je meteen de prijs voor jouw teamgrootte.
          </p>
          <div className="tm-cta-row">
            <a
              className="tm-btn tm-btn-primary"
              href={demoHref}
              {...(demoExtern ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              Plan een demo
            </a>
            <Link className="tm-btn tm-btn-ghost" href="/team/aanvragen">Direct aanvragen</Link>
          </div>
        </section>

      </div>

      <SiteFooter />
    </>
  )
}
