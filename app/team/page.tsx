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
        .tm-backlink a {
          font-family: 'Oswald', sans-serif; font-size: 13px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase;
          color: #94a3b8; text-decoration: none; border-bottom: 1px solid #475569; padding-bottom: 3px;
          transition: color 0.15s, border-color 0.15s;
        }
        .tm-backlink a:hover { color: #f59e0b; border-color: #f59e0b; }
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

        /* Waar het om draait */
        .tm-draait { max-width: 1040px; margin: 0 auto; padding: 72px 24px 24px; }
        .tm-draait-head { max-width: 22ch; margin: 0 auto 48px; text-align: center; }
        .tm-draait-head .tm-h2 { font-size: clamp(30px, 4.4vw, 48px); line-height: 1.08; }
        .tm-amber { color: #f59e0b; }
        .tm-draait-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 72px; }
        .tm-draait-item { padding: 28px 0 32px; border-top: 1px solid #2a3547; text-align: left; }
        .tm-draait-item h3 {
          font-family: 'Oswald', sans-serif; font-size: 24px; font-weight: 600; text-transform: uppercase;
          color: #f8fafc; line-height: 1.15; margin-bottom: 10px;
        }
        .tm-draait-item p { font-size: 16px; line-height: 1.7; color: #94a3b8; max-width: 42ch; }
        .tm-draait-slot {
          margin-top: 24px; text-align: center; font-family: 'Oswald', sans-serif; font-size: clamp(22px, 3vw, 30px);
          font-weight: 600; text-transform: uppercase; line-height: 1.2; color: #f8fafc;
        }

        /* Verkeerde keuze of verkeerde begeleiding */
        .tm-keuze { max-width: 1040px; margin: 0 auto; padding: 56px 24px 24px; }
        .tm-keuze-head { max-width: 62ch; margin: 0 auto 36px; text-align: center; }
        .tm-keuze-head .tm-lead { margin: 18px auto 0; }
        .tm-keuze-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .tm-keuze-card { background: #1e293b; border: 1px solid #2a3547; border-radius: 12px; padding: 28px; text-align: left; }
        .tm-keuze-card h3 {
          font-family: 'Oswald', sans-serif; font-size: 20px; font-weight: 600; text-transform: uppercase;
          color: #f8fafc; letter-spacing: 0.04em; margin-bottom: 10px;
        }
        .tm-keuze-card p { font-size: 15px; line-height: 1.65; color: #94a3b8; }

        /* AVG */
        .tm-avg { max-width: 1040px; margin: 0 auto; padding: 56px 24px 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: start; }
        .tm-avg-tekst .tm-lead { margin-top: 18px; }
        .tm-avg-lijst { border-top: 1px solid #2a3547; }
        .tm-avg-rij { display: grid; grid-template-columns: 11ch 1fr; gap: 20px; padding: 18px 0; border-bottom: 1px solid #2a3547; text-align: left; }
        .tm-avg-rij dt { font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #f59e0b; }
        .tm-avg-rij dd { font-size: 15px; line-height: 1.6; color: #cbd5e1; }

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

        .tm-final { text-align: center; padding: 64px 0 80px; }
        .tm-final .tm-h2 { margin-bottom: 14px; }
        .tm-final p { font-size: 16px; color: #94a3b8; max-width: 46ch; margin: 0 auto 28px; line-height: 1.7; }

        @media (max-width: 820px) {
          .tm-big-list { grid-template-columns: 1fr; }
          .tm-draait-grid { grid-template-columns: 1fr; }
          .tm-keuze-grid { grid-template-columns: 1fr; }
          .tm-avg { grid-template-columns: 1fr; gap: 32px; }
          .tm-avg-rij { grid-template-columns: 1fr; gap: 6px; }
          .tm-seven { padding: 48px 20px; }
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
        </div>
      </section>

      <p className="tm-backlink"><Link href="/">Wat je verkopers krijgen &rarr;</Link></p>

      <figure className="tm-heroshot">
        <div className="tm-heroshot-frame">
          <img src="/team/overzicht.jpg" width="1566" height="873" alt="Het teamdashboard: de score van elke verkoper naast elkaar met de teamtrend over de maanden" />
        </div>
        <figcaption>Je hele team in één scherm, bijgewerkt na elk gesprek dat je verkopers voeren.</figcaption>
      </figure>

      <section className="tm-draait">
        <div className="tm-draait-head">
          <p className="tm-label">Waar het om draait</p>
          <h2 className="tm-h2">Je hebt goede mensen aangenomen. <span className="tm-amber">Nu moet het eruit komen.</span></h2>
        </div>
        <div className="tm-draait-grid">
          <div className="tm-draait-item">
            <h3>Talent komt niet vanzelf tot bloei.</h3>
            <p>Het groeit door herhaling, eerlijke feedback en iemand die doorvraagt.</p>
          </div>
          <div className="tm-draait-item">
            <h3>Je kunt het niet voor ze doen.</h3>
            <p>Wie het overneemt, wint de deal en houdt de verkoper afhankelijk.</p>
          </div>
          <div className="tm-draait-item">
            <h3>Coaching groeit niet mee met je agenda.</h3>
            <p>Hoe groter het team, hoe minder tijd er per verkoper overblijft.</p>
          </div>
          <div className="tm-draait-item">
            <h3>Achterstand zie je pas in de cijfers.</h3>
            <p>En dan is het kwartaal meestal al bijna voorbij.</p>
          </div>
        </div>
        <p className="tm-draait-slot">Dat ligt niet aan jouw leiderschap. <span className="tm-amber">Er is maar één van jou.</span></p>
      </section>

      <div className="tm-wrap">

        <section className="tm-section tm-section-narrow" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <p className="tm-label">Wat geen manager kan</p>
          <h2 className="tm-h2">Ook de beste manager kan dit niet alleen</h2>
          <p className="tm-lead" style={{ marginTop: 18 }}>
            Niet door gebrek aan inzet, maar omdat er maar één van hem is.<br />Daar vult ArnoBot aan.
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
        </div>

        <section className="tm-keuze">
          <div className="tm-keuze-head">
            <p className="tm-label">Voordat je conclusies trekt</p>
            <h2 className="tm-h2">Verkeerde keuze? <span className="tm-amber">Of verkeerde begeleiding?</span></h2>
            <p className="tm-lead">
              Een verkoper die achterblijft, kost je meer dan omzet. Het kost je tijd, energie en
              soms het vertrouwen in je eigen oordeel. ArnoBot laat per verkoper zien waar het
              zit, op drie lagen.
            </p>
          </div>
          <div className="tm-keuze-grid">
            <div className="tm-keuze-card">
              <h3>Mindset</h3>
              <p>Gelooft hij in zichzelf, het product en de prijs? Of remt twijfel hem al af vóór het gesprek begint?</p>
            </div>
            <div className="tm-keuze-card">
              <h3>Systeem</h3>
              <p>Heeft hij een aanpak die werkt, of improviseert hij elk gesprek opnieuw en lekt hij kansen in de opvolging?</p>
            </div>
            <div className="tm-keuze-card">
              <h3>Actie</h3>
              <p>Weet hij wat hij moet doen, maar gebeurt het niet? Te weinig gesprekken, te laat bellen, te snel opgeven.</p>
            </div>
          </div>
        </section>

        <section className="tm-seven">
          <p className="tm-label">En dan jijzelf</p>
          <h2 className="tm-h2">Wie coacht jou eigenlijk?</h2>
          <p>
            Jij coacht je mensen. Maar wie kijkt naar hoe jij dat doet? Wie helpt jou met je
            1:1&apos;s, met je blinde vlekken, met wat je team van jou nodig heeft? ArnoBot
            coacht ook jou: eerlijk, zonder agenda, op elk moment.
          </p>
          <p>
            Geen vervanging van jou. Je mensen volgen jou, niet een tool. ArnoBot zorgt dat jouw
            coaching doorwerkt tussen de momenten dat je ze spreekt.
          </p>
        </section>

        <section className="tm-avg">
          <div className="tm-avg-tekst">
            <p className="tm-label">AVG</p>
            <h2 className="tm-h2">Liever vooraf geregeld <span className="tm-amber">dan achteraf uitgelegd.</span></h2>
            <p className="tm-lead">
              Een systeem dat iets zegt over hoe medewerkers presteren, vraagt om een goed gesprek
              vooraf. Betrek je functionaris gegevensbescherming dus voor de start, niet erna. Wij
              leveren je de antwoorden op de vragen die hij of zij gaat stellen.
            </p>
          </div>
          <dl className="tm-avg-lijst">
            <div className="tm-avg-rij"><dt>Opslag</dt><dd>Binnen de EU.</dd></div>
            <div className="tm-avg-rij"><dt>Bewaartermijn</dt><dd>Zolang het account actief is. Na beëindiging verwijderd of geanonimiseerd binnen 30 dagen.</dd></div>
            <div className="tm-avg-rij"><dt>AI-training</dt><dd>Nee. Jouw gegevens worden niet gebruikt om modellen te trainen.</dd></div>
            <div className="tm-avg-rij"><dt>Wie ziet wat</dt><dd>Jij ziet de diagnose en de scores, nooit de gesprekken van je verkopers.</dd></div>
            <div className="tm-avg-rij"><dt>Verwerkers&shy;overeenkomst</dt><dd>Op aanvraag.</dd></div>
          </dl>
        </section>

      <div className="tm-wrap">
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
            Dertig minuten, jouw vragen, een ingericht voorbeeldteam. Of sla de demo over en
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
