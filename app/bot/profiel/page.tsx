'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import BotNav from '@/app/bot/BotNav'

type Answers = {
  rol: string
  gebruik: string
  markt: string[]
  wat_verkoop_je: string
  ideale_klant: string
  uitdaging: string
  dealgrootte: string
  salescyclus: string
  teamgrootte: string
  jaren_sales: string
  jaren_functie: string
  // Alleen de solopreneur-versie (rol === 'Solopreneur', geen team)
  positionering: string
  klantenbron: string[]
  kanaal_afhankelijkheid: string
  acquisitie_tijd: string
}

const empty: Answers = {
  rol: '',
  gebruik: '',
  markt: [],
  wat_verkoop_je: '',
  ideale_klant: '',
  uitdaging: '',
  dealgrootte: '',
  salescyclus: '',
  teamgrootte: '',
  jaren_sales: '',
  jaren_functie: '',
  positionering: '',
  klantenbron: [],
  kanaal_afhankelijkheid: '',
  acquisitie_tijd: '',
}

function getUitdagingPlaceholder(rol: string): string {
  if (rol === 'AE Hunter') return 'Bijv: Ik kom wel binnen maar verlies deals in de afrondingsfase.'
  if (rol === 'AM Farmer') return 'Bijv: Mijn klanten waarderen me maar kopen ook bij de concurrent.'
  if (rol === 'Key AM') return 'Bijv: Ik word gezien als leverancier, niet als strategisch partner.'
  if (rol === 'Inside Sales') return 'Bijv: Mijn gesprekken lopen goed maar stranden op prijs.'
  if (rol === 'Sales Director') return 'Bijv: Mijn team haalt de cijfers niet en ik weet niet precies waarom.'
  if (rol === 'VP of Sales') return 'Bijv: Ik ben te veel bezig met operationele zaken en te weinig met strategie.'
  if (rol === 'CEO/DGA') return 'Bijv: De omzet groeit maar ik ben er zelf nog te veel voor nodig.'
  if (rol === 'Solopreneur') return 'Bijv: Ik heb genoeg werk maar het komt niet vanzelf, ik moet blijven jagen.'
  return 'Bijv: Mijn conversie in het tweede gesprek is te laag, ik verlies deals op prijs...'
}

const TEAMGROOTTE_OPTIONS = ['1-3', '4-10', '11-25', '>25']
const ROL_OPTIONS = ['AE Hunter', 'AM Farmer', 'Key AM', 'Inside Sales', 'Sales Director', 'VP of Sales', 'CEO/DGA', 'Solopreneur', 'Anders']
const HEEFT_TEAM = ['Sales Director', 'VP of Sales', 'CEO/DGA']
// Rollen die alleen zinnig zijn voor wie zélf een team aanmaakt of leidt, niet voor wie er via
// een uitnodigingslink lid van wordt. Solopreneur hoort hier ook bij: geen teamverband.
const MANAGEMENT_ROLLEN = [...HEEFT_TEAM, 'Solopreneur']
// Rollen voor wie al als command_manager staat geregistreerd (het Team-segment, gezet bij
// trial-aanmaak via een Sales Agent-link, zie proxy.ts): een eigen, vaste lijst i.p.v. een
// filter op ROL_OPTIONS, want Sales Manager en CCO staan niet in die algemene lijst
// (2026-08-24, teamprofiel-herziening, zie docs/TEAM_PLAN.md).
const TEAM_VERSIE_ROL_OPTIONS = ['Sales Manager', 'Sales Director', 'VP of Sales', 'CCO', 'Anders']
const JAREN_SALES_OPTIONS = ['< 2 jaar', '2-5 jaar', '5-10 jaar', '10-20 jaar', '> 20 jaar']
const JAREN_FUNCTIE_OPTIONS = ['< 1 jaar', '1-3 jaar', '3-7 jaar', '> 7 jaar']
// Bandbreedtes i.p.v. vrije tekst: sneller ingevuld en de marge is precies wat de
// systeemprompt nodig heeft. Bestaande profielen met een oude vrije-tekstwaarde matchen geen
// knop; die gebruiker herkiest bij de eerstvolgende profielaanpassing.
const DEALGROOTTE_OPTIONS = ['< €1k', '€1-10k', '€10-50k', '€50-250k', '> €250k']
const SALESCYCLUS_OPTIONS = ['< 1 week', '1-4 weken', '1-3 maanden', '3-6 maanden', '6-12 maanden', '> 12 maanden']

// Welke profielvelden bij welke formuliervariant horen. Bij het opslaan wordt het profiel
// hiermee opnieuw opgebouwd, niet met de volledige answers-state: zo verdwijnen velden van
// een eerder gekozen rol (bv. een positionering die als solo is ingevuld en daarna naar
// een teamrol is geswitcht) uit het opgeslagen profiel in plaats van als spookcontext in de
// systeemprompt te blijven hangen. Overwrite, geen merge (de route doet .upsert op de hele
// profiel-JSON).
const PROFIEL_GEDEELD: (keyof Answers)[] = ['rol', 'gebruik', 'markt', 'wat_verkoop_je', 'ideale_klant', 'dealgrootte', 'salescyclus', 'jaren_sales', 'jaren_functie', 'uitdaging']
const PROFIEL_VELDEN: Record<'team' | 'individueel' | 'solo', (keyof Answers)[]> = {
  team: [...PROFIEL_GEDEELD],
  individueel: [...PROFIEL_GEDEELD, 'teamgrootte'],
  solo: [...PROFIEL_GEDEELD, 'positionering', 'klantenbron', 'kanaal_afhankelijkheid', 'acquisitie_tijd'],
}

// Solopreneur-versie (rol === 'Solopreneur', geen team, geen command_manager): een eigen
// intake omdat een zelfstandige geen team heeft, maar wel een positionering, een
// acquisitiekanaal en een spanning tussen acquireren en leveren. Zie docs/TEAM_PLAN.md,
// "Punt 2 vervangen", stap 3.
const KLANTENBRON_OPTIONS = ['Aanbeveling', 'Netwerk', 'Outbound', 'Content/inbound', 'Terugkerende klanten', 'Toeval']
const KANAAL_AFHANKELIJKHEID_OPTIONS = ['Sterk van één kanaal', 'Deels gespreid', 'Goed gespreid']
const ACQUISITIE_TIJD_OPTIONS = ['< 10%', '10-25%', '25-50%', '> 50%']

const MARKT_OPTIONS = ['B2B MKB', 'B2B Enterprise', 'B2C', 'Overheid', 'Investeerders']

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 18px',
        border: selected ? '2px solid #f59e0b' : '1.5px solid #374151',
        background: selected ? 'rgba(245,158,11,0.12)' : '#1f2937',
        color: selected ? '#f59e0b' : '#9ca3af',
        fontFamily: "'Space Mono', monospace",
        fontSize: 15,
        fontWeight: 400,
        cursor: 'pointer',
        borderRadius: 4,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function Block({ nr, title, children }: { nr: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48, borderBottom: '1px solid #374151', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#f59e0b' }}>{nr}</span>
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, fontWeight: 400, color: '#f1f5f9', margin: 0, letterSpacing: 1 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function BotProfielPage() {
  const { user } = useUser()
  const [answers, setAnswers] = useState<Answers>(empty)
  const [rolAnders, setRolAnders] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null)

  const [submitted, setSubmitted] = useState(false)
  const [isTeamMember, setIsTeamMember] = useState(false)
  const [isCommandManager, setIsCommandManager] = useState(false)
  // Bij een mislukte /api/bot/profiel-fetch weten we niet of dit account een teamlid is,
  // dus mag rolOpties hieronder niet stil terugvallen op de volledige, ongefilterde lijst
  // inclusief managementrollen. Restrictie bij twijfel, niet de ruimste optie.
  const [profielFetchFailed, setProfielFetchFailed] = useState(false)
  const firstName = user?.firstName || 'daar'

  useEffect(() => {
    fetch('/api/bot/profiel')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setIsTeamMember(data?.isTeamMember ?? false)
        setIsCommandManager(data?.isCommandManager ?? false)
        if (data?.profiel) {
          setAnswers(prev => ({ ...prev, ...data.profiel }))
          setIsFirstTime(false)
        } else {
          setIsFirstTime(true)
        }
      })
      .catch(() => {
        setProfielFetchFailed(true)
        setIsFirstTime(true)
      })
  }, [])

  const rolOpties = isCommandManager
    ? TEAM_VERSIE_ROL_OPTIONS
    : (isTeamMember || profielFetchFailed)
      ? ROL_OPTIONS.filter(o => !MANAGEMENT_ROLLEN.includes(o))
      : ROL_OPTIONS

  function set(key: keyof Answers, val: string) {
    setAnswers(prev => ({ ...prev, [key]: val }))
  }

  function toggleMarkt(val: string) {
    setAnswers(prev => ({
      ...prev,
      markt: prev.markt.includes(val) ? prev.markt.filter(v => v !== val) : [...prev.markt, val]
    }))
  }

  function toggleKlantenbron(val: string) {
    setAnswers(prev => ({
      ...prev,
      klantenbron: prev.klantenbron.includes(val) ? prev.klantenbron.filter(v => v !== val) : [...prev.klantenbron, val]
    }))
  }

  const rolIngevuld = answers.rol && (answers.rol !== 'Anders' || rolAnders.trim().length > 1)

  // Een zelfstandige zonder team krijgt de solopreneur-intake. isCommandManager (Team-segment)
  // sluit dit uit: die lijst bevat 'Solopreneur' sowieso niet.
  const isSolo = !isCommandManager && answers.rol === 'Solopreneur'

  const allFilled = isSolo
    ? (
      rolIngevuld &&
      answers.markt.length > 0 &&
      answers.wat_verkoop_je.trim().length > 2 &&
      answers.ideale_klant.trim().length > 2 &&
      answers.positionering.trim().length > 2 &&
      answers.dealgrootte !== '' &&
      answers.salescyclus !== '' &&
      answers.klantenbron.length > 0 &&
      answers.kanaal_afhankelijkheid !== '' &&
      answers.acquisitie_tijd !== '' &&
      answers.jaren_sales !== '' &&
      answers.jaren_functie !== '' &&
      answers.uitdaging.trim().length > 2
    )
    : (
      rolIngevuld &&
      answers.markt.length > 0 &&
      answers.wat_verkoop_je.trim().length > 2 &&
      answers.ideale_klant.trim().length > 2 &&
      answers.uitdaging.trim().length > 2 &&
      answers.dealgrootte !== '' &&
      answers.salescyclus !== '' &&
      answers.jaren_sales !== '' &&
      answers.jaren_functie !== '' &&
      (!HEEFT_TEAM.includes(answers.rol) || isCommandManager || (answers.gebruik !== '' && answers.teamgrootte !== ''))
    )

  async function handleSubmit() {
    if (!allFilled) {
      setSubmitted(true)
      setTimeout(() => {
        const el = document.querySelector('[data-error="true"]')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }
    setSaving(true)
    setError('')
    try {
      const variant = isCommandManager ? 'team' : isSolo ? 'solo' : 'individueel'
      const schoonProfiel: Record<string, unknown> = { team_waitlist: false }
      for (const key of PROFIEL_VELDEN[variant]) schoonProfiel[key] = answers[key]
      schoonProfiel.rol = answers.rol === 'Anders' ? rolAnders.trim() : answers.rol

      const res = await fetch('/api/bot/profiel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiel: schoonProfiel }),
      })
      if (!res.ok) throw new Error('Opslaan mislukt')
      window.location.href = '/bot'
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.')
      setSaving(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-size: 15px; font-weight: 400; line-height: 30px; }
        textarea, input {
          background: #1f2937; color: #f1f5f9; border: 1.5px solid #374151;
          border-radius: 4px; font-family: 'Space Mono', monospace;
          font-size: 15px; font-weight: 400; padding: 12px 16px; width: 100%;
          box-sizing: border-box; outline: none; resize: vertical;
          transition: border-color 0.15s; line-height: 30px;
        }
        textarea:focus, input:focus { border-color: #f59e0b; }
        textarea::placeholder, input::placeholder { color: #4b5563; }
      `}</style>

      {isFirstTime === false && <BotNav active="profiel" />}
      {isFirstTime === true && (
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 48, height: 3, background: '#f59e0b', borderRadius: 2 }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: 2, color: '#f59e0b' }}>PROFIEL</span>
          </div>
        </nav>
      )}

      {isFirstTime === null ? (
        <div style={{ minHeight: '100vh' }} />
      ) : (
      <div style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ maxWidth: 812, margin: '0 auto', padding: '60px clamp(16px,4vw,20px) 0' }}>

          <div style={{ borderBottom: '3px solid #f59e0b', paddingBottom: 32, marginBottom: 48 }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>
              {isFirstTime ? 'WELKOM' : 'JOUW PROFIEL'}
            </p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, color: '#f1f5f9', lineHeight: 1.05, letterSpacing: 3, marginBottom: 24 }}>
              {isFirstTime ? `Goed dat je er bent, ${firstName}.` : 'Profiel aanpassen'}
            </h1>
            <div style={{ borderLeft: '4px solid #f59e0b', paddingLeft: 20, color: '#9ca3af', fontSize: 15, lineHeight: 1.9 }}>
              <p style={{ color: '#f1f5f9', fontWeight: 400, marginBottom: 8 }}>ArnoBot stemt zijn coaching af op jouw situatie.</p>
              <p>{isFirstTime ? 'Een paar korte vragen, dan kun je aan de slag. ' : ''}Hoe meer ArnoBot weet over wie jij bent en wat je verkoopt, hoe gerichter het advies. Wees bloedeerlijk; dit is jouw persoonlijke omgeving. Er kijkt niemand mee.</p>
            </div>
          </div>

          <Block nr="01" title="Wie ben je?">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Wat is je rol?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {rolOpties.map(o => (
                <Chip key={o} label={o} selected={answers.rol === o} onClick={() => { set('rol', o); if (!HEEFT_TEAM.includes(o)) { set('teamgrootte', ''); set('gebruik', '') } }} />
              ))}
            </div>
            {answers.rol === 'Anders' && (
              <input
                value={rolAnders}
                onChange={e => setRolAnders(e.target.value)}
                placeholder="Jouw rol..."
                style={{ marginTop: 12 }}
              />
            )}
            {submitted && !rolIngevuld && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Selecteer je rol.</p>
            )}
            {HEEFT_TEAM.includes(answers.rol) && !isCommandManager && (
              <>
                <div style={{ marginTop: 24 }}>
                  <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Gebruik je ArnoBot individueel of voor jouw team?</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Chip label="INDIVIDUEEL" selected={answers.gebruik === 'individueel'} onClick={() => set('gebruik', 'individueel')} />
                    <Chip label="VOOR MIJN TEAM" selected={answers.gebruik === 'team'} onClick={() => set('gebruik', 'team')} />
                  </div>
                  {submitted && answers.gebruik === '' && (
                    <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Geef aan of je ArnoBot individueel of voor je team gebruikt.</p>
                  )}
                  {answers.gebruik === 'team' && (
                    <div style={{ marginTop: 20, background: '#1f2937', border: '1px solid #374151', borderLeft: '3px solid #f59e0b', padding: '20px 24px' }}>
                      <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 10 }}>ARNOBOT TEAM</p>
                      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>
                        Elke verkoper een eigen coach, jij het overzicht over je team. Bekijk wat het inhoudt op <Link href="/team" style={{ color: '#f59e0b', textDecoration: 'underline' }}>de teampagina</Link>. Vul hieronder verder je eigen profiel in.
                      </p>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 24 }}>
                  <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Hoe groot is je sales team?</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {TEAMGROOTTE_OPTIONS.map(o => (
                      <Chip key={o} label={o} selected={answers.teamgrootte === o} onClick={() => set('teamgrootte', o)} />
                    ))}
                  </div>
                  {submitted && answers.teamgrootte === '' && (
                    <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Geef aan hoe groot je sales team is.</p>
                  )}
                </div>
              </>
            )}
          </Block>

          <Block nr="02" title={isCommandManager ? 'Jullie markt' : 'Jouw markt'}>
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>
              {isCommandManager ? 'In welke markt(en) zijn jullie actief?' : 'In welke markt ben je actief?'} <span style={{ color: '#6b7280' }}>(meerdere antwoorden mogelijk)</span>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {MARKT_OPTIONS.map(o => (
                <Chip key={o} label={o} selected={answers.markt.includes(o)} onClick={() => toggleMarkt(o)} />
              ))}
            </div>
            {submitted && answers.markt.length === 0 && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Selecteer minimaal één markt.</p>
            )}
          </Block>

          <Block nr="03" title={isCommandManager ? 'Jullie dienstverlening' : 'Wat verkoop je?'}>
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>{isCommandManager ? 'Omschrijf kort wat jullie verkopen' : 'Omschrijf kort wat je verkoopt'}</p>
            <textarea
              value={answers.wat_verkoop_je}
              onChange={e => set('wat_verkoop_je', e.target.value)}
              placeholder="Bijv: Software voor HR-teams bij scale-ups, jaarcontracten van €15k tot €40k..."
              rows={3}
            />
            {submitted && answers.wat_verkoop_je.trim().length <= 2 && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Omschrijf wat je verkoopt.</p>
            )}
          </Block>

          <Block nr="04" title={isCommandManager ? 'Jullie ideale klant' : 'Jouw ideale klant'}>
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>{isCommandManager ? 'Wat is het profiel van een topklant?' : 'Wie is jouw ideale klant?'}</p>
            <textarea
              value={answers.ideale_klant}
              onChange={e => set('ideale_klant', e.target.value)}
              placeholder="Bijv: CFO's bij productiebedrijven met 50 tot 200 medewerkers, beslissen op cijfers..."
              rows={3}
            />
            {submitted && answers.ideale_klant.trim().length <= 2 && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Omschrijf je ideale klant.</p>
            )}
          </Block>

          {isSolo ? (
          <>
          <Block nr="05" title="Positionering">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Waarin ben je aantoonbaar anders dan de alternatieven voor jouw klant?</p>
            <textarea
              value={answers.positionering}
              onChange={e => set('positionering', e.target.value)}
              placeholder="Bijv: Ik ben de enige in mijn vakgebied die ook de implementatie zelf doet, niet alleen het advies."
              rows={3}
            />
            {submitted && answers.positionering.trim().length <= 2 && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Omschrijf waarin je anders bent.</p>
            )}
          </Block>

          <Block nr="06" title="Opdrachtwaarde">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Wat levert een gemiddelde opdracht op?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DEALGROOTTE_OPTIONS.map(o => (
                <Chip key={o} label={o} selected={answers.dealgrootte === o} onClick={() => set('dealgrootte', o)} />
              ))}
            </div>
            {submitted && answers.dealgrootte === '' && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Maak een keuze.</p>
            )}
          </Block>

          <Block nr="07" title="Doorlooptijd">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Hoe lang duurt het van eerste contact tot een getekende opdracht?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SALESCYCLUS_OPTIONS.map(o => (
                <Chip key={o} label={o} selected={answers.salescyclus === o} onClick={() => set('salescyclus', o)} />
              ))}
            </div>
            {submitted && answers.salescyclus === '' && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Maak een keuze.</p>
            )}
          </Block>

          <Block nr="08" title="Acquisitie">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Waar komen je klanten vandaan? <span style={{ color: '#6b7280' }}>(meerdere antwoorden mogelijk)</span></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {KLANTENBRON_OPTIONS.map(o => (
                <Chip key={o} label={o} selected={answers.klantenbron.includes(o)} onClick={() => toggleKlantenbron(o)} />
              ))}
            </div>
            {submitted && answers.klantenbron.length === 0 && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Selecteer minimaal één kanaal.</p>
            )}
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Hoe afhankelijk ben je van één kanaal?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {KANAAL_AFHANKELIJKHEID_OPTIONS.map(o => (
                  <Chip key={o} label={o} selected={answers.kanaal_afhankelijkheid === o} onClick={() => set('kanaal_afhankelijkheid', o)} />
                ))}
              </div>
              {submitted && answers.kanaal_afhankelijkheid === '' && (
                <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Maak een keuze.</p>
              )}
            </div>
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Hoeveel van je tijd gaat naar nieuwe klanten binnenhalen?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ACQUISITIE_TIJD_OPTIONS.map(o => (
                  <Chip key={o} label={o} selected={answers.acquisitie_tijd === o} onClick={() => set('acquisitie_tijd', o)} />
                ))}
              </div>
              {submitted && answers.acquisitie_tijd === '' && (
                <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Maak een keuze.</p>
              )}
            </div>
          </Block>

          <Block nr="09" title="Jouw ervaring">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Hoe lang zit je al in sales?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: submitted && answers.jaren_sales === '' ? 8 : 28 }}>
              {JAREN_SALES_OPTIONS.map(o => (
                <Chip key={o} label={o} selected={answers.jaren_sales === o} onClick={() => set('jaren_sales', o)} />
              ))}
            </div>
            {submitted && answers.jaren_sales === '' && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8, marginBottom: 20 }}>Maak een keuze.</p>
            )}
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Hoe lang werk je al als zelfstandige?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {JAREN_FUNCTIE_OPTIONS.map(o => (
                <Chip key={o} label={o} selected={answers.jaren_functie === o} onClick={() => set('jaren_functie', o)} />
              ))}
            </div>
            {submitted && answers.jaren_functie === '' && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Maak een keuze.</p>
            )}
          </Block>

          <Block nr="10" title="Je grootste uitdaging">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Wat is je persoonlijke uitdaging?</p>
            <textarea
              value={answers.uitdaging}
              onChange={e => set('uitdaging', e.target.value)}
              placeholder={getUitdagingPlaceholder(answers.rol)}
              rows={3}
            />
            {submitted && answers.uitdaging.trim().length <= 2 && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Omschrijf je grootste uitdaging.</p>
            )}
          </Block>
          </>
          ) : (
          <>
          <Block nr="05" title="Gemiddelde dealgrootte">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Wat is de gemiddelde waarde van een deal?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DEALGROOTTE_OPTIONS.map(o => (
                <Chip key={o} label={o} selected={answers.dealgrootte === o} onClick={() => set('dealgrootte', o)} />
              ))}
            </div>
            {submitted && answers.dealgrootte === '' && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Maak een keuze.</p>
            )}
          </Block>

          <Block nr="06" title="Salescyclus">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Hoe lang duurt een gemiddeld salestraject?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SALESCYCLUS_OPTIONS.map(o => (
                <Chip key={o} label={o} selected={answers.salescyclus === o} onClick={() => set('salescyclus', o)} />
              ))}
            </div>
            {submitted && answers.salescyclus === '' && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Maak een keuze.</p>
            )}
          </Block>

          <Block nr="07" title="Jouw ervaring">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Hoe lang zit je al in sales?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: submitted && answers.jaren_sales === '' ? 8 : 28 }}>
              {JAREN_SALES_OPTIONS.map(o => (
                <Chip key={o} label={o} selected={answers.jaren_sales === o} onClick={() => set('jaren_sales', o)} />
              ))}
            </div>
            {submitted && answers.jaren_sales === '' && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8, marginBottom: 20 }}>Maak een keuze.</p>
            )}
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>Hoe lang doe je al de functie die je hierboven hebt aangegeven?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {JAREN_FUNCTIE_OPTIONS.map(o => (
                <Chip key={o} label={o} selected={answers.jaren_functie === o} onClick={() => set('jaren_functie', o)} />
              ))}
            </div>
            {submitted && answers.jaren_functie === '' && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Maak een keuze.</p>
            )}
          </Block>

          <Block nr="08" title="Je grootste uitdaging">
            <p style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.9, color: '#9ca3af', marginBottom: 12 }}>{isCommandManager ? 'Wat is je grootste persoonlijke uitdaging?' : 'Wat is je persoonlijke uitdaging?'}</p>
            <textarea
              value={answers.uitdaging}
              onChange={e => set('uitdaging', e.target.value)}
              placeholder={getUitdagingPlaceholder(answers.rol)}
              rows={3}
            />
            {submitted && answers.uitdaging.trim().length <= 2 && (
              <p data-error="true" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#cc2200', marginTop: 8 }}>Omschrijf je grootste uitdaging.</p>
            )}
          </Block>
          </>
          )}

          {error && <p style={{ color: '#cc2200', fontSize: 15, fontWeight: 400, lineHeight: 1.9, marginBottom: 16 }}>{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '12px 36px',
              background: '#f59e0b',
              color: '#111827',
              border: 'none', borderRadius: 999,
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 18, letterSpacing: 3,
              cursor: 'pointer',
              transition: 'background 0.2s',
              display: 'block', margin: '0 auto',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Bezig...' : isFirstTime ? 'START →' : 'PROFIEL OPSLAAN →'}
          </button>

</div>
      </div>
      )}
    </>
  )
}
