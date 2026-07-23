'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import BotNav from '@/app/bot/BotNav'

function renderAnswer(text: React.ReactNode) {
  if (typeof text !== 'string') return text
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (match) return <a key={i} href={match[2]} style={{ color: '#f59e0b', textDecoration: 'none' }}>{match[1]}</a>
    return part
  })
}

const FAQ_GROUPS = [
  {
    label: 'OVER ARNOBOT',
    items: [
      {
        q: 'Wat is ArnoBot precies?',
        a: 'ArnoBot is een AI-salescoach, half man, half machine, die uitsluitend antwoord geeft vanuit de expertise en content van Arno Diepeveen. Meer dan 40 jaar sales ervaring uit de voorhoede, 20 jaar sales blogs met inzichten, cases en coaching. Er komt geen generieke AI aan te pas. Just Arno.',
      },
      {
        q: 'Waarom geen ChatGPT o.i.d.?',
        a: 'ChatGPT e.a. zijn generieke LLM\'s. Het middelt wat het kan vinden. ArnoBot heeft focus op jouw profiel, groei en succes. Daarnaast is ArnoBot transparant en neemt geen blad voor de mond. ArnoBot heeft maar één doel en dat is jouw sales engine chippen tot buitengewone resultaten. Hij redeneert uitsluitend binnen het kader van Arno\'s content.',
      },
      {
        q: 'Wat als het antwoord niet klopt?',
        a: 'ArnoBot antwoordt altijd vanuit de bibliotheek. Als een antwoord je verbaast, kun je doorvragen. Gebruik je eigen oordeel, net als bij een gesprek met een echte coach.',
      },
    ],
  },
  {
    label: 'DE ROUTE',
    items: [
      {
        q: 'Hoe werkt ArnoBot stap voor stap?',
        a: 'Voer eerst gesprekken, maak dan een patroonanalyse in de Archief, en vraag daarna een coachingsadvies aan. De respectievelijke pagina\'s staan in het menu: ArnoBot, Archief, Coaching. Elke stap bouwt voort op de vorige. Hoe meer je erin stopt, hoe meer je eruit haalt.',
      },
      {
        q: 'Hoe gebruik ik de gesprekken optimaal?',
        a: 'Wees concreet. Beschrijf je situatie, je markt en je uitdaging zo specifiek mogelijk. Stel vragen zoals je dat aan een senior advisor zou doen. Elk gesprek vergroot het beeld dat Arno van je opbouwt.',
      },
      {
        q: 'Wat is een patroonanalyse en hoe maak ik er een?',
        a: 'Ga naar de Archief, selecteer de gesprekken waar je een duiding op wilt (maximaal 20) en klik op Analyseer. ArnoBot geeft je de rode draad: wat komt steeds terug, wat valt op, wat vraagt aandacht. Maak er geregeld een. Hoe meer je analyseert, hoe scherper het patroon waar je iets mee kunt.',
      },
      {
        q: 'Wanneer kan ik een coachingsadvies opvragen?',
        a: 'Dat kan als je minimaal 5 gesprekken hebt gevoerd. Ga dan naar Coaching en klik op de knop Adviseer. Arno combineert je gesprekken, profiel en eerdere analyses op drie pijlers: Mindset, Systeem en Actie. Het resultaat wordt elke keer scherper naarmate je meer hebt opgebouwd.',
      },
      {
        q: 'Waarom kan ik maximaal 20 gesprekken selecteren voor een analyse?',
        a: 'Een analyse wordt scherper als Arno zich kan focussen. Boven de 20 gesprekken verdunnen de patronen zich. Je krijgt dan een gemiddelde in plaats van een diagnose. Twintig gesprekken is het maximum waarbij de analyse nog concreet en bruikbaar is.',
      },
      {
        q: 'Kan ik een eerder gesprek voortzetten?',
        a: 'Ja. Al je gesprekken staan in de Archief. Open een gesprek, scroll naar beneden en klik op "Zet dit gesprek voort bij ArnoBot?" ArnoBot pakt de draad op waar je gebleven was.',
      },
    ],
  },
  {
    label: 'SPARREN',
    items: [
      {
        q: 'Wat is het verschil tussen Coaching en Sparren?',
        a: 'Bij Coaching beschrijf jij een situatie en geeft ArnoBot advies. Bij Sparren speelt ArnoBot de uitdager: een prospect, je CEO, een underperformer. Jij oefent het gesprek live. Coaching helpt je nadenken. Sparren helpt je presteren als het erop aankomt.',
      },
      {
        q: 'Voor wie is Sparren beschikbaar?',
        a: 'Sparren is beschikbaar voor alle rollen: verkopers, solopreneurs, salesmanagers en CEO\'s. Elke rol heeft zijn eigen set uitdagers, afgestemd op de gesprekken die jij in de praktijk voert.',
      },
      {
        q: 'Wat betekent de weerstandsinstelling?',
        a: 'Licht: de ander is professioneel kritisch maar beweegt mee als je argumenten kloppen. Stevig: harde vragen, geen cadeau. Zwaar: sceptisch, onderbreekt bij vaagheden, geeft vrijwel nooit toe zonder bewijs. Begin met Stevig als je niet weet waar je staat.',
      },
      {
        q: 'Wat gebeurt er na een sparring-sessie?',
        a: 'ArnoBot geeft een debrief: wat ging goed, het kritieke moment waarop je de controle verloor of het momentum brak, een herkenbaar patroon uit je eerdere coaching, en één concrete tip voor het volgende gesprek.',
      },
      {
        q: 'Waarom kan ik niet kiezen hoe lang het antwoord is, zoals bij ArnoBot?',
        a: 'Bij ArnoBot geef jij een situatie en krijg je advies. Dan is antwoordlengte zinvol. Bij Sparren speelt ArnoBot een tegenpartij in een echt oefengesprek. Die bepaalt zelf hoe lang hij antwoordt, net zoals in het echte leven. De weerstandsinstelling stuurt dat organisch: licht geeft kortere, meegaande reacties. Zwaar geeft langere pushback.',
      },
    ],
  },
  {
    label: 'ABONNEMENT',
    items: [
      {
        q: 'Hoeveel kost ArnoBot?',
        a: 'ArnoBot heeft meerdere niveaus. Premium, het meest gekozen abonnement, kost €97 per maand of €777 per jaar. Bekijk het volledige overzicht op de prijzenpagina. Je begint altijd met een gratis proefperiode van 30 dagen, zonder verplichtingen.',
      },
      {
        q: 'Hoe lang duurt de proefperiode?',
        a: 'Je hebt 30 dagen gratis toegang. Op dag 25 vragen we of je wilt doorgaan. Als je niets doet, stopt je toegang automatisch op dag 30.',
      },
      {
        q: 'Hoe zeg ik op?',
        a: 'Via de accountpagina, met één klik. Je toegang blijft actief tot het einde van de lopende betaalperiode. Je data blijft daarna nog 30 dagen beschikbaar om te downloaden of te verwijderen.',
      },
    ],
  },
  {
    label: 'REFERRAL',
    items: [
      {
        q: 'Hoe werkt het referralprogramma?',
        a: 'Deel je persoonlijke referral-link vanuit je profiel. Zodra iemand zich aanmeldt via jouw link en een betaald abonnement afsluit, ontvang jij tegoed en wordt dat verrekend op de factuur. Bij een maandabonnement na drie voltooide betaalmaanden. Bij een jaarabonnement direct na de eerste betaling.',
      },
      {
        q: 'Hoe hoog is het tegoed?',
        a: 'Per succesvolle referral ontvang je €97 tegoed. Dit wordt verrekend met je eerstvolgende factuur. Het tegoed is niet uitbetaalbaar in contanten.',
      },
    ],
  },
  {
    label: 'JOUW TEAM',
    items: [
      {
        q: 'Kan mijn manager mijn gesprekken inzien?',
        a: (
          <>
            Nee. Alles wat je met ArnoBot bespreekt, is strikt vertrouwelijk. Je manager heeft geen toegang tot je gesprekken of de inhoud ervan.
            <br /><br />
            Wat je manager wel ziet: je drie scores op mindset, systeem en actie, plus een korte duiding per dimensie. Dat is een patroon dat ArnoBot destilleert, geen citaat of samenvatting van wat je hebt gezegd. Verder ziet de manager hoeveel gesprekken je hebt gevoerd.
            <br /><br />
            Wat de manager niet ziet: de inhoud van je gesprekken, je analyses, klantnamen of specifieke situaties.
            <br /><br />
            Wil je zelf iets delen? Dat kan. In de ARCHIEF kun je bij elke analyse op &ldquo;Deel met manager&rdquo; klikken. Die verschijnt dan 1 op 1 in het overzicht van je manager.
          </>
        ),
      },
    ],
  },
  {
    label: 'PRIVACY',
    items: [
      {
        q: 'Zijn mijn gegevens veilig?',
        a: (
          <>
            Jouw gesprekken en profiel zijn strikt vertrouwelijk. We slaan je gegevens op bij gecertificeerde sub-verwerkers (Supabase, Clerk, Vercel, Anthropic). Je kunt je data altijd downloaden of je account verwijderen. Lees onze{' '}
            <a href="/privacy" style={{ color: '#f59e0b', textDecoration: 'none' }}>privacyverklaring</a>.
          </>
        ),
      },
      {
        q: 'Wie heeft toegang tot mijn gesprekken?',
        a: 'Alleen jijzelf. Arno Diepeveen heeft als verwerkingsverantwoordelijke toegang tot de systemen, maar leest geen individuele gesprekken. Je gesprekken worden verwerkt door Anthropic voor de AI-analyse en opgeslagen bij Supabase. Beide partijen zijn GDPR-compliant.',
      },
      {
        q: 'Kan ik een document uploaden in een gesprek?',
        a: 'Ja, in de hoofdchat kun je een PDF, Word-document of afbeelding toevoegen, bijvoorbeeld om je salesplan te laten checken. Dat bestand wordt niet opgeslagen, alleen gebruikt om die ene vraag te beantwoorden en daarna direct weggegooid. Maximaal 10MB per bestand.',
      },
      {
        q: 'Kan ik mijn account en data verwijderen?',
        a: 'Ja. Via de accountpagina kun je je account verwijderen. Al je gesprekken, je profiel en je analyseresultaten worden dan direct gewist.',
      },
      {
        q: 'Zijn gedeelde gesprekken openbaar?',
        a: 'Ja. Als jij kiest om een gesprek te delen via "Deel dit gesprek", is de link toegankelijk voor iedereen die hem heeft. Gedeelde gesprekken kunnen worden geïndexeerd door zoekmachines.',
      },
      {
        q: 'Kan ik een gedeelde link weer intrekken?',
        a: 'Dat is op dit moment nog niet mogelijk. Deze functie wordt meegenomen in de volgende release. Wil je een gedeeld gesprek laten verwijderen, stuur dan een e-mail naar [hq@arno.bot](mailto:hq@arno.bot). We regelen het dan handmatig.',
      },
    ],
  },
]

export default function QAClient({ isOnboarding }: { isOnboarding: boolean }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [isTeamMember, setIsTeamMember] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('previewMember') === '1') {
      setIsTeamMember(true)
      return
    }
    fetch('/api/bot/team/status')
      .then(r => r.json())
      .then(d => { if (d.hasTeam && !d.isManager) setIsTeamMember(true) })
      .catch(() => {})
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        .qa-continue:hover { background: #d97706 !important; }
        .faq-item { border-bottom: 1px solid #374151; }
        .faq-question {
          width: 100%; background: none; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: space-between;
          padding: 24px 0; gap: 16px; text-align: left;
        }
        .faq-question:hover .faq-q-text { color: #f1f5f9; }
        .faq-q-text {
          font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px;
          color: #f1f5f9; transition: color 0.15s; line-height: 1.3;
        }
        .faq-arrow {
          font-family: 'Bebas Neue', sans-serif; font-size: 18px;
          color: #6b7280; flex-shrink: 0; transition: color 0.15s;
        }
        .faq-arrow.open { color: #f59e0b; }
        .faq-answer {
          font-family: 'Space Mono', monospace; font-size: 15px;
          color: #9ca3af; line-height: 1.9; padding-bottom: 28px;
        }
      `}</style>

      {isOnboarding ? (
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          padding: '0 clamp(20px, 4vw, 40px)', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(17,24,39,0.95)', backdropFilter: 'blur(12px)',
        }}>
          <Link href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: '#f1f5f9', textDecoration: 'none' }}>
            ARNO<span style={{ color: '#f59e0b' }}>BOT.</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 48, height: 3, background: '#f59e0b', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: 2, color: '#f59e0b' }}>VIDEO</span>
            </div>
            <div style={{ width: 16, height: 1, background: '#374151', marginBottom: 13 }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 48, height: 3, background: '#374151', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: 2, color: '#4b5563' }}>PROFIEL</span>
            </div>
          </div>
        </nav>
      ) : (
        <BotNav active="qa" />
      )}

      <div style={{ minHeight: '100vh', paddingTop: 64, background: '#111827' }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(60px,8vw,80px) clamp(16px,4vw,20px) 80px' }}>

          <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(40px, 6vw, 64px)', color: '#f1f5f9', lineHeight: 1.0, letterSpacing: 3, marginBottom: 16 }}>
            Video
          </h1>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', lineHeight: 1.9, marginBottom: 48 }}>
            Dit is de video die je bij je ArnoBot entree hebt gezien. Heb je vragen die hier niet beantwoord worden? Neem dan contact op met Arno op{' '}
            <a href="https://t.me/arnodiepeveen" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b', textDecoration: 'none' }}>Telegram</a>. Niet de bot, de man 😎
          </p>

          {/* Video */}
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, marginBottom: 64, overflow: 'hidden' }}>
            <iframe
              src="https://www.loom.com/embed/0ac8f70256fa4ecb8d49bc111c897050?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true"
              frameBorder={0}
              allowFullScreen
              style={{ position: 'absolute', top: -36, left: 0, width: '100%', height: 'calc(100% + 36px)' }}
            />
          </div>

          {/* FAQ */}
          <div style={{ borderTop: '2px solid #f59e0b', paddingTop: 40, marginBottom: 64 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>VRAGEN</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, color: '#f1f5f9', lineHeight: 1.0, marginBottom: 48 }}>
              FAQ
            </h2>

            {FAQ_GROUPS.filter(g => {
              if (isTeamMember && g.label === 'REFERRAL') return false
              if (isTeamMember && g.label === 'ABONNEMENT') return false
              if (!isTeamMember && g.label === 'JOUW TEAM') return false
              return true
            }).map((group, gi) => (
              <div key={gi} style={{ marginBottom: 48 }}>
                <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 4, textTransform: 'uppercase' }}>{group.label}</p>
                <div style={{ borderTop: '1px solid #374151' }}>
                  {group.items.map((faq, fi) => {
                    const key = `${gi}-${fi}`
                    const isOpen = openKey === key
                    return (
                      <div key={fi} className="faq-item">
                        <button
                          className="faq-question"
                          onClick={() => setOpenKey(isOpen ? null : key)}
                        >
                          <span className="faq-q-text">{faq.q}</span>
                          <span className={`faq-arrow${isOpen ? ' open' : ''}`}>{isOpen ? '↑' : '↓'}</span>
                        </button>
                        {isOpen && (
                          <p className="faq-answer">{renderAnswer(faq.a)}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {isOnboarding && (
            <div style={{ textAlign: 'center' }}>
              <Link
                href="/bot/profiel"
                className="qa-continue"
                style={{
                  display: 'inline-block', padding: '12px 36px',
                  background: '#f59e0b', color: '#111827',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 18, letterSpacing: 3,
                  textDecoration: 'none', borderRadius: 999, transition: 'background 0.2s',
                }}
              >
                I&apos;M READY.
              </Link>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
