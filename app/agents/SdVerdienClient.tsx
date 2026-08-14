'use client'

import { useEffect, useRef, useState } from 'react'

const HORIZON = 60
const PRIJZEN = {
  maandelijks: { platform: 97, perSeat: 49 },
  jaarlijks: { platform: 77, perSeat: 39 },
} as const
type Facturatie = keyof typeof PRIJZEN

// Gemiddelde omzet per solo-gebruiker, afgeleid uit Arno's eigen sheet:
// 80% Basic (€228/jr) + 20% Pro (€468/jr) = €276/jaar = €23/maand per gebruiker.
const SOLO_OMZET_PER_GEBRUIKER_PER_MAAND = 23

type Maand = {
  maand: number
  newBusiness: number
  recurringBusiness: number
  churn: number
  netto: number
  ruweOmzet: number
  klantenAantal: number
}

type Deel2 = {
  maand: number
  bedrag: number
  onbegrensd: number
  plafond: number
  soloOmzet: number
  teamBuitenOmzet: number
  pool: number
  geplafonneerd: boolean
}

function eur(n: number): string {
  return '€ ' + Math.round(n).toLocaleString('nl-NL')
}

function aantal(n: number): string {
  return Math.round(n).toLocaleString('nl-NL')
}

// Per-cohort simulatie met churn: elke maand komt er (instroom) klanten bij, en dooft
// elke cohort geleidelijk uit met het churn-percentage. Het wervingstempo zelf groeit
// exponentieel mee met het ingevulde jaarlijkse groeipercentage. Gaat uit van een SDR
// die continu actief blijft werven (40% jaar 1, 20% daarna), de 3-maanden-stilte-regel
// (terugval naar 5%) staat los hiervan en is niet interactief in deze berekening verwerkt.
function berekenPerMaand(instroom: number, omzetPerKlant: number, churnPct: number, groeiPct: number): Maand[] {
  const churn = churnPct / 100
  const groei = groeiPct / 100
  const maanden: Maand[] = []
  for (let m = 1; m <= HORIZON; m++) {
    let newBusiness = 0, recurringBusiness = 0, churnVerlies = 0
    let ruweOmzet = 0, klantenAantal = 0
    for (let a = 1; a <= m; a++) {
      const leeftijd = m - a
      const overleving = Math.pow(1 - churn, leeftijd)
      const overlevingVorigeMaand = leeftijd > 0 ? Math.pow(1 - churn, leeftijd - 1) : 1
      const fasePct = leeftijd < 12 ? 0.40 : 0.20
      const instroomEffectief = instroom * Math.pow(1 + groei, (a - 1) / 12)
      const cohortBasis = instroomEffectief * omzetPerKlant
      const bijdrage = cohortBasis * overleving * fasePct

      ruweOmzet += cohortBasis * overleving
      klantenAantal += instroomEffectief * overleving

      if (leeftijd === 0) {
        newBusiness += bijdrage
      } else {
        recurringBusiness += bijdrage
        const bijdrageZonderChurnDezeMaand = cohortBasis * overlevingVorigeMaand * fasePct
        churnVerlies += (bijdrageZonderChurnDezeMaand - bijdrage)
      }
    }
    const netto = newBusiness + recurringBusiness
    maanden.push({ maand: m, newBusiness, recurringBusiness, churn: churnVerlies, netto, ruweOmzet, klantenAantal })
  }
  return maanden
}

// Solo-omzet groeit net als de teamklanten: elke maand komt er een fractie van het
// jaarlijkse blok bij, zelf ook groeiend met hetzelfde jaarlijkse groeipercentage als
// het wervingstempo. Elke fractie dooft daarna uit met hetzelfde churn-percentage.
function berekenSoloOmzetPerMaand(soloJaarOmzet: number, churnPct: number, groeiPct: number): number[] {
  const churn = churnPct / 100
  const groei = groeiPct / 100
  const cohortPerMaand = soloJaarOmzet / 12
  const perMaand: number[] = []
  for (let m = 1; m <= HORIZON; m++) {
    let totaal = 0
    for (let a = 1; a <= m; a++) {
      const leeftijd = m - a
      const cohortEffectief = cohortPerMaand * Math.pow(1 + groei, (a - 1) / 12)
      totaal += cohortEffectief * Math.pow(1 - churn, leeftijd)
    }
    perMaand.push(totaal)
  }
  return perMaand
}

// Ruwe (niet-gecommissioneerde) omzet-cohorten, herbruikt voor teamklanten die buiten
// de SD-links om binnenkomen. Zelfde cohort-en-churnlogica als de hoofdberekening, maar
// dan alleen de omzet zelf, want die stroomt rechtstreeks (ongefaseerd) de deel-2-pool in.
function berekenRuweOmzetPerMaand(instroom: number, omzetPerKlant: number, churnPct: number, groeiPct: number): number[] {
  const churn = churnPct / 100
  const groei = groeiPct / 100
  const perMaand: number[] = []
  for (let m = 1; m <= HORIZON; m++) {
    let totaal = 0
    for (let a = 1; a <= m; a++) {
      const leeftijd = m - a
      const instroomEffectief = instroom * Math.pow(1 + groei, (a - 1) / 12)
      totaal += instroomEffectief * omzetPerKlant * Math.pow(1 - churn, leeftijd)
    }
    perMaand.push(totaal)
  }
  return perMaand
}

// Deel 2: gedeeld aandeel in de rest van het bedrijf. Pool = solo-omzet plus teamklanten
// die buiten de SD-links om binnenkomen (geen teamexpansie binnen hun eigen klanten, dat
// wordt bewust niet apart gemodelleerd, middelt in de praktijk tegen churn). 50/50 verdeeld
// tussen twee SDR's, 40% commissie over de eigen helft = 20% van het totaal, geplafonneerd
// op de eigen commissie (deel 1) van diezelfde maand.
function berekenDeel2(data: Maand[], soloOmzetPerMaandArr: number[], teamBuitenOmzetPerMaandArr: number[]): Deel2[] {
  return data.map((d, i) => {
    const soloOmzet = soloOmzetPerMaandArr[i]
    const teamBuitenOmzet = teamBuitenOmzetPerMaandArr[i]
    const pool = soloOmzet + teamBuitenOmzet
    const onbegrensd = pool * 0.20
    const plafond = d.netto
    const bedrag = Math.min(onbegrensd, plafond)
    return { maand: d.maand, bedrag, onbegrensd, plafond, soloOmzet, teamBuitenOmzet, pool, geplafonneerd: onbegrensd > plafond }
  })
}

function tekenChart(
  canvas: HTMLCanvasElement,
  data: Maand[],
  deel2: Deel2[],
  markMaand: number
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const cssWidth = canvas.clientWidth || 1120
  const cssHeight = 300
  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  const padL = 60, padR = 66, padT = 16, padB = 26
  const w = cssWidth - padL - padR
  const h = cssHeight - padT - padB

  const maxTotal = Math.max(...data.map((d, i) => d.newBusiness + d.recurringBusiness + d.churn + deel2[i].bedrag), 1)
  const niceMax = Math.ceil(maxTotal / 100) * 100 || 100
  const zeroY = padT + h
  const scaleY = h / niceMax

  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.fillStyle = '#5b6576'
  ctx.font = '11px ui-sans-serif, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle';
  [1, 0.75, 0.5, 0.25, 0].forEach(frac => {
    const val = niceMax * frac
    const y = zeroY - val * scaleY
    ctx.beginPath()
    ctx.moveTo(padL, y)
    ctx.lineTo(padL + w, y)
    ctx.stroke()
    ctx.fillText('€' + Math.round(val), padL - 10, y)
  })

  const slotW = w / data.length
  const barW = slotW - 1
  const cumValues: number[] = []
  let running = 0
  data.forEach((d, i) => { running += d.netto + deel2[i].bedrag; cumValues.push(running) })
  const maxCum = Math.max(...cumValues, 1)
  const niceMaxCum = Math.ceil(maxCum / 1000) * 1000 || 1000

  data.forEach((d, i) => {
    const x = padL + i * slotW

    if (d.maand === markMaand) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fillRect(x, padT, barW, h)
    }

    let yUp = zeroY
    const recH = d.recurringBusiness * scaleY
    ctx.fillStyle = '#34d399'
    ctx.fillRect(x, yUp - recH, barW, recH)
    yUp -= recH

    const newH = d.newBusiness * scaleY
    ctx.fillStyle = '#f59e0b'
    ctx.fillRect(x, yUp - newH, barW, newH)
    yUp -= newH

    const churnH = d.churn * scaleY
    ctx.fillStyle = '#f87171'
    ctx.fillRect(x, yUp - churnH, barW, churnH)
    yUp -= churnH

    const deel2H = deel2[i].bedrag * scaleY
    ctx.fillStyle = '#a78bfa'
    ctx.fillRect(x, yUp - deel2H, barW, deel2H)

    if (d.maand === markMaand) {
      ctx.strokeStyle = 'rgba(241,245,249,0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, padT + 0.5, barW - 1, h - 1)
    }
  })

  ctx.strokeStyle = '#f1f5f9'
  ctx.lineWidth = 2
  ctx.beginPath()
  cumValues.forEach((v, i) => {
    const x = padL + i * slotW + barW / 2
    const y = padT + h - (v / niceMaxCum) * h
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  })
  ctx.stroke()

  ctx.fillStyle = '#f1f5f9'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle';
  [0, 0.25, 0.5, 0.75, 1].forEach(frac => {
    const val = niceMaxCum * frac
    const y = padT + h - frac * h
    ctx.fillText('€' + Math.round(val).toLocaleString('nl-NL'), padL + w + 8, y)
  })

  ctx.fillStyle = '#5b6576'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let jaar = 1; jaar <= 5; jaar++) {
    const maandIdx = jaar * 12 - 1
    const x = padL + maandIdx * slotW + slotW / 2
    ctx.fillText('jaar ' + jaar, x, padT + h + 8)
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.moveTo(padL, zeroY)
  ctx.lineTo(padL + w, zeroY)
  ctx.stroke()

  ;(canvas as any)._padL = padL
  ;(canvas as any)._slotW = slotW
  ;(canvas as any)._count = data.length
}

// Zelfde opzet als tekenChart, maar dan één staaf per maand, in twee kleuren
// (eigen aandeel + gedeeld aandeel), geen verdere uitsplitsing.
function tekenTotaalChart(
  canvas: HTMLCanvasElement,
  data: Maand[],
  deel2: Deel2[],
  markMaand: number
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const cssWidth = canvas.clientWidth || 1120
  const cssHeight = 300
  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  const padL = 60, padR = 66, padT = 16, padB = 26
  const w = cssWidth - padL - padR
  const h = cssHeight - padT - padB

  const totalen = data.map((d, i) => d.netto + deel2[i].bedrag)
  const maxTotal = Math.max(...totalen, 1)
  const niceMax = Math.ceil(maxTotal / 100) * 100 || 100
  const zeroY = padT + h
  const scaleY = h / niceMax

  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.fillStyle = '#5b6576'
  ctx.font = '11px ui-sans-serif, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle';
  [1, 0.75, 0.5, 0.25, 0].forEach(frac => {
    const val = niceMax * frac
    const y = zeroY - val * scaleY
    ctx.beginPath()
    ctx.moveTo(padL, y)
    ctx.lineTo(padL + w, y)
    ctx.stroke()
    ctx.fillText('€' + Math.round(val), padL - 10, y)
  })

  const slotW = w / data.length
  const barW = slotW - 1
  const cumValues: number[] = []
  let running = 0
  totalen.forEach(v => { running += v; cumValues.push(running) })
  const maxCum = Math.max(...cumValues, 1)
  const niceMaxCum = Math.ceil(maxCum / 1000) * 1000 || 1000

  data.forEach((d, i) => {
    const x = padL + i * slotW

    if (d.maand === markMaand) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fillRect(x, padT, barW, h)
    }

    const eigenH = d.netto * scaleY
    ctx.fillStyle = '#f59e0b'
    ctx.fillRect(x, zeroY - eigenH, barW, eigenH)

    const gedeeldH = deel2[i].bedrag * scaleY
    ctx.fillStyle = '#a78bfa'
    ctx.fillRect(x, zeroY - eigenH - gedeeldH, barW, gedeeldH)

    if (d.maand === markMaand) {
      ctx.strokeStyle = 'rgba(241,245,249,0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, padT + 0.5, barW - 1, h - 1)
    }
  })

  ctx.strokeStyle = '#f1f5f9'
  ctx.lineWidth = 2
  ctx.beginPath()
  cumValues.forEach((v, i) => {
    const x = padL + i * slotW + barW / 2
    const y = padT + h - (v / niceMaxCum) * h
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  })
  ctx.stroke()

  ctx.fillStyle = '#f1f5f9'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle';
  [0, 0.25, 0.5, 0.75, 1].forEach(frac => {
    const val = niceMaxCum * frac
    const y = padT + h - frac * h
    ctx.fillText('€' + Math.round(val).toLocaleString('nl-NL'), padL + w + 8, y)
  })

  ctx.fillStyle = '#5b6576'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let jaar = 1; jaar <= 5; jaar++) {
    const maandIdx = jaar * 12 - 1
    const x = padL + maandIdx * slotW + slotW / 2
    ctx.fillText('jaar ' + jaar, x, padT + h + 8)
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.moveTo(padL, zeroY)
  ctx.lineTo(padL + w, zeroY)
  ctx.stroke()

  ;(canvas as any)._padL = padL
  ;(canvas as any)._slotW = slotW
  ;(canvas as any)._count = data.length
}

export default function SdVerdienClient({ isAdmin }: { isAdmin: boolean }) {
  const [instroom, setInstroom] = useState(4)
  const [seats, setSeats] = useState(5)
  const [churnPct, setChurnPct] = useState(5)
  const [groeiPct, setGroeiPct] = useState(20)
  const [soloJaarOmzet, setSoloJaarOmzet] = useState(33120)
  const [instroomBuiten, setInstroomBuiten] = useState(1)
  const [facturatie, setFacturatie] = useState<Facturatie>('maandelijks')
  const [gemarkeerdeMaand, setGemarkeerdeMaand] = useState(1)
  const [weergave, setWeergave] = useState<'agent' | 'arnobot'>('agent')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasTotaalRef = useRef<HTMLCanvasElement>(null)

  const p = PRIJZEN[facturatie]
  const omzetPerKlant = p.platform + seats * p.perSeat

  const data = berekenPerMaand(instroom, omzetPerKlant, churnPct, groeiPct)
  const soloOmzetPerMaand = berekenSoloOmzetPerMaand(soloJaarOmzet, churnPct, groeiPct)
  const teamBuitenOmzetPerMaand = berekenRuweOmzetPerMaand(instroomBuiten, omzetPerKlant, churnPct, groeiPct)
  const deel2 = berekenDeel2(data, soloOmzetPerMaand, teamBuitenOmzetPerMaand)

  const maandIdx = Math.max(1, Math.min(HORIZON, gemarkeerdeMaand)) - 1
  const dMaand = data[maandIdx]
  const dDeel2 = deel2[maandIdx]

  const cum5jrEigen = data.reduce((s, d) => s + d.netto, 0)
  const cum5jrDeel2 = deel2.reduce((s, d) => s + d.bedrag, 0)
  const cumDeel2 = deel2.reduce((s, x) => s + x.bedrag, 0)

  const teamGebruikersEigen = Math.round(dMaand.klantenAantal * seats)
  const teamGebruikersBuiten = Math.round((teamBuitenOmzetPerMaand[maandIdx] / omzetPerKlant) * seats)
  const soloGebruikers = Math.round(soloOmzetPerMaand[maandIdx] / SOLO_OMZET_PER_GEBRUIKER_PER_MAAND)
  const totaalGebruikers = teamGebruikersEigen + teamGebruikersBuiten + soloGebruikers

  // ArnoBot-weergave: bedrijfsdeel over eigen aangebrachte klanten (ruwe omzet minus wat
  // de SDR zelf krijgt), dus de 60%/80%-tegenhanger van deel 1. Alleen deze klanten, geen
  // aanname nodig over wat de collega uit de gedeelde pool krijgt.
  const bedrijfsdeelDezeMaand = dMaand.ruweOmzet - dMaand.netto
  const bedrijfsdeelCumulatief = data.reduce((s, d) => s + (d.ruweOmzet - d.netto), 0)
  const bedrijfsdeelPct = dMaand.ruweOmzet > 0 ? (bedrijfsdeelDezeMaand / dMaand.ruweOmzet) * 100 : 0

  useEffect(() => {
    if (canvasRef.current) tekenChart(canvasRef.current, data, deel2, gemarkeerdeMaand)
    if (canvasTotaalRef.current) tekenTotaalChart(canvasTotaalRef.current, data, deel2, gemarkeerdeMaand)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instroom, seats, churnPct, groeiPct, soloJaarOmzet, instroomBuiten, facturatie, gemarkeerdeMaand])

  useEffect(() => {
    function onResize() {
      if (canvasRef.current) tekenChart(canvasRef.current, data, deel2, gemarkeerdeMaand)
      if (canvasTotaalRef.current) tekenTotaalChart(canvasTotaalRef.current, data, deel2, gemarkeerdeMaand)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCanvasClick(canvas: HTMLCanvasElement, e: React.MouseEvent) {
    const padL = (canvas as any)._padL
    const slotW = (canvas as any)._slotW
    const count = (canvas as any)._count
    if (!slotW) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const idx = Math.floor((x - padL) / slotW)
    if (idx >= 0 && idx < count) setGemarkeerdeMaand(idx + 1)
  }

  return (
    <div style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 'clamp(24px, 4vw, 56px) clamp(16px, 4vw, 48px) 64px', display: 'flex', flexDirection: 'column', gap: 26 }}>

        <header style={{ paddingBottom: 8, borderBottom: '1px solid #2d3a4d' }}>
          <p style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#f59e0b', fontWeight: 600 }}>ArnoBot Sales Development</p>
          <h1 style={{ fontSize: 'clamp(30px, 4.2vw, 42px)', fontWeight: 800, letterSpacing: '-0.5px', marginTop: 6, textWrap: 'balance' }}>Performance Fee</h1>
          <p style={{ color: '#8b96a8', fontSize: 15, lineHeight: 1.7, maxWidth: '64ch', marginTop: 10 }}>
            Vul in hoeveel klanten je gemiddeld per maand denkt te converteren naar betalend, met hoeveel users en hoeveel er gemiddeld weer opzeggen (churn). De grafiek laat per maand zien wat binnenloopt (new business), wat doorloopt (recurring business), en wat wegloopt (churn), plus de 20% fee die je ontvangt op de omzet die niet door agents is gegenereerd.
          </p>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 6, background: '#1f2937', border: '1.5px solid #2d3a4d', borderRadius: 9, padding: 3, width: 'fit-content', marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setWeergave('agent')}
                style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: weergave === 'agent' ? '#1a1306' : '#8b96a8', background: weergave === 'agent' ? '#f59e0b' : 'none', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}
              >Sales Agent-weergave</button>
              <button
                type="button"
                onClick={() => setWeergave('arnobot')}
                style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: weergave === 'arnobot' ? '#1a1306' : '#8b96a8', background: weergave === 'arnobot' ? '#f59e0b' : 'none', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}
              >ArnoBot-weergave</button>
            </div>
          )}
        </header>

        {weergave === 'arnobot' && isAdmin && (
          <section style={{ background: '#1a2333', border: '1px solid #2d3a4d', borderRadius: 14, padding: '24px clamp(20px, 3vw, 32px)' }}>
            <p style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8b96a8', fontWeight: 600, marginBottom: 12 }}>ArnoBot-weergave, alleen voor jou zichtbaar</p>
            <p style={{ fontSize: 14, color: '#8b96a8', lineHeight: 1.7, maxWidth: '68ch', marginBottom: 18 }}>
              Het bedrijfsdeel over de klanten die deze Sales Agent zelf aanbrengt: de omgekeerde kant van hun 40%/20%-commissie. Gaat uitsluitend over hun eigen klanten, geen aanname nodig over de collega of de gedeelde pool.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div style={{ background: '#1f2937', border: '1px solid #2d3a4d', borderRadius: 14, padding: '20px 22px' }}>
                <span style={{ display: 'block', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8b96a8', fontWeight: 600 }}>Bedrijfsdeel, maand {gemarkeerdeMaand}</span>
                <span style={{ display: 'block', fontSize: 28, fontWeight: 800, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{eur(bedrijfsdeelDezeMaand)}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#5b6576', marginTop: 4 }}>{bedrijfsdeelPct.toFixed(0)}% van de ruwe klantomzet die maand</span>
              </div>
              <div style={{ background: '#1f2937', border: '1px solid #2d3a4d', borderRadius: 14, padding: '20px 22px' }}>
                <span style={{ display: 'block', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8b96a8', fontWeight: 600 }}>Bedrijfsdeel, cumulatief over 5 jaar</span>
                <span style={{ display: 'block', fontSize: 28, fontWeight: 800, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{eur(bedrijfsdeelCumulatief)}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#5b6576', marginTop: 4 }}>tegenover {eur(cum5jrEigen)} aan hun eigen commissie</span>
              </div>
            </div>
          </section>
        )}

        <section style={{ background: '#1a2333', border: '1px solid #2d3a4d', borderRadius: 14, padding: '24px clamp(20px, 3vw, 32px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '22px 28px' }}>
          <Field label="Nieuwe klanten per maand">
            <NumberInput value={instroom} onChange={setInstroom} min={0} max={20} step={1} />
            <Unit>gemiddeld</Unit>
          </Field>
          <Field label="Gebruikers per klant">
            <NumberInput value={seats} onChange={setSeats} min={3} max={100} step={1} />
            <Unit>seats</Unit>
          </Field>
          <Field label="Churn">
            <NumberInput value={churnPct} onChange={setChurnPct} min={0} max={30} step={0.5} />
            <Unit>% opzeggingen</Unit>
          </Field>
          <Field label="Groei in wervingstempo">
            <NumberInput value={groeiPct} onChange={setGroeiPct} min={0} max={200} step={5} />
            <Unit>% per jaar</Unit>
          </Field>
          <div>
            <label style={{ display: 'block', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8b96a8', fontWeight: 600, marginBottom: 10 }}>Facturatiewijze van de klant</label>
            <div style={{ display: 'flex', gap: 6, background: '#1f2937', border: '1.5px solid #2d3a4d', borderRadius: 9, padding: 3, width: 'fit-content' }}>
              <button
                type="button"
                onClick={() => setFacturatie('maandelijks')}
                style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: facturatie === 'maandelijks' ? '#1a1306' : '#8b96a8', background: facturatie === 'maandelijks' ? '#f59e0b' : 'none', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}
              >Maandelijks</button>
              <button
                type="button"
                onClick={() => setFacturatie('jaarlijks')}
                style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: facturatie === 'jaarlijks' ? '#1a1306' : '#8b96a8', background: facturatie === 'jaarlijks' ? '#f59e0b' : 'none', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}
              >Jaarlijks</button>
            </div>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <QsTile label="Deze maand (maand 1)" value={eur(data[0].netto + deel2[0].bedrag)} sub="wat je nu verdient" />
          <QsTile label="Na 12 maanden" value={eur(data[11].netto + deel2[11].bedrag)} sub="maandelijkse verdiensten op dat moment" />
          <QsTile label="Cumulatief over 5 jaar" value={eur(cum5jrEigen + cum5jrDeel2)} sub="opgeteld, na churn en jouw activiteit" />
        </section>

        <section style={{ background: '#1a2333', border: '1px solid #2d3a4d', borderRadius: 14, padding: '24px clamp(16px, 3vw, 28px) 20px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Jouw inkomsten per maand, over 5 jaar</h2>
          <p style={{ fontSize: 13, color: '#5b6576', marginTop: 3 }}>Elke staaf toont wat jij die maand persoonlijk opbouwt: nieuw, doorlopend, churn en jouw eigen aandeel uit de gedeelde pool. De lijn erboven is jouw cumulatieve totaal, rechteras.</p>
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <canvas ref={canvasRef} width={1120} height={300} style={{ display: 'block', width: '100%', height: 300, cursor: 'crosshair' }} onClick={e => canvasRef.current && handleCanvasClick(canvasRef.current, e)} />
          </div>
          <Legend items={[
            ['#f59e0b', 'New business'],
            ['#34d399', 'Recurring business'],
            ['#f87171', 'Churn'],
            ['#a78bfa', 'Gedeeld aandeel (rest van het bedrijf)'],
          ]} withLine />
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #2d3a4d', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, color: '#8b96a8' }}>
            <span style={{ fontWeight: 700, color: '#f1f5f9', width: '100%', fontSize: 14 }}>Maand {dMaand.maand}</span>
            <span>New business: <b style={{ color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{eur(dMaand.newBusiness)}</b></span>
            <span>Recurring, eigen omzet: <b style={{ color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{eur(dMaand.recurringBusiness)}</b></span>
            <span>Recurring, bedrijfsomzet: <b style={{ color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{eur(dDeel2.bedrag)}</b></span>
            <span>Churn: <b style={{ color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>-{eur(dMaand.churn)}</b></span>
            <span>Netto deze maand: <b style={{ color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{eur(dMaand.netto + dDeel2.bedrag)}</b></span>
            <span style={{ fontWeight: 700, color: '#f1f5f9', width: '100%', fontSize: 14, marginTop: 4 }}>
              Totaal aantal gebruikers: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{aantal(totaalGebruikers)}</b> ({aantal(teamGebruikersEigen)} eigen team, {aantal(teamGebruikersBuiten)} team buiten links, {aantal(soloGebruikers)} solo)
            </span>
          </div>
        </section>

        <section style={{ background: '#1a2333', border: '1px solid #2d3a4d', borderRadius: 14, padding: '24px clamp(16px, 3vw, 28px) 20px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Wat jij persoonlijk meeneemt per maand</h2>
          <p style={{ fontSize: 13, color: '#5b6576', marginTop: 3 }}>Eén staaf per maand, in twee kleuren: jouw eigen aandeel over zelf aangebrachte klanten, en jouw eigen aandeel uit de gedeelde pool, niet van jou en je collega samen. De lijn erboven is jouw cumulatieve totaal, rechteras.</p>
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <canvas ref={canvasTotaalRef} width={1120} height={300} style={{ display: 'block', width: '100%', height: 300, cursor: 'crosshair' }} onClick={e => canvasTotaalRef.current && handleCanvasClick(canvasTotaalRef.current, e)} />
          </div>
          <Legend items={[
            ['#f59e0b', 'Eigen aandeel'],
            ['#a78bfa', 'Gedeeld aandeel (rest van het bedrijf)'],
          ]} withLine />
        </section>

        <section style={{ background: '#1a2333', border: '1px solid #2d3a4d', borderRadius: 14, padding: '24px clamp(16px, 3vw, 28px) 20px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Plus: jouw aandeel in de rest van het bedrijf</h2>
          <p style={{ fontSize: 13, color: '#5b6576', marginTop: 3, maxWidth: '68ch' }}>
            Naast je eigen klanten krijg je ook een deel van de omzet (20%) die niet door agents is gegenereerd, van zowel solo- als teamabonnementen.
          </p>
          <div style={{ marginTop: 18, maxWidth: 420 }}>
            <label style={{ display: 'block', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8b96a8', fontWeight: 600, marginBottom: 10 }}>Nieuwe solo-omzet van de rest van het bedrijf, per jaar</label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ color: '#5b6576', fontSize: 13 }}>€</span>
              <NumberInput value={soloJaarOmzet} onChange={setSoloJaarOmzet} min={0} step={1000} width={120} />
            </div>
            <span style={{ display: 'block', fontSize: 12, color: '#5b6576', marginTop: 6 }}>elk jaar komt er een nieuw blok bij, dat daarna net als teamklanten uitdooft met hetzelfde churn-percentage hierboven</span>
          </div>
          <div style={{ marginTop: 18, maxWidth: 420 }}>
            <label style={{ display: 'block', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8b96a8', fontWeight: 600, marginBottom: 10 }}>Nieuwe teamklanten buiten de SD-links om, per maand</label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <NumberInput value={instroomBuiten} onChange={setInstroomBuiten} min={0} max={20} step={1} />
              <Unit>gemiddeld</Unit>
            </div>
            <span style={{ display: 'block', fontSize: 12, color: '#5b6576', marginTop: 6 }}>bijvoorbeeld doordat jij zelf een Team-deal sluit, zelfde prijs/seats/churn als hierboven</span>
          </div>

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #2d3a4d', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 15, color: '#f1f5f9' }}>
              Jouw aandeel in maand {dMaand.maand}: <b style={{ color: '#a78bfa', fontVariantNumeric: 'tabular-nums', fontSize: 20 }}>{eur(dDeel2.bedrag)}</b> per maand
              <span style={{
                display: 'inline-block', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, padding: '2px 8px', borderRadius: 999, marginLeft: 8,
                background: dDeel2.geplafonneerd ? 'rgba(251, 146, 60, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                color: dDeel2.geplafonneerd ? '#fb923c' : '#34d399',
              }}>{dDeel2.geplafonneerd ? 'geplafonneerd' : 'volledig uitbetaald'}</span>
            </div>
            <div style={{ fontSize: 13, color: '#5b6576' }}>
              De pool die maand: <b style={{ color: '#8b96a8', fontVariantNumeric: 'tabular-nums' }}>{eur(dDeel2.soloOmzet)}</b> solo-omzet + <b style={{ color: '#8b96a8', fontVariantNumeric: 'tabular-nums' }}>{eur(dDeel2.teamBuitenOmzet)}</b> teamklanten buiten de links om = <b style={{ color: '#8b96a8', fontVariantNumeric: 'tabular-nums' }}>{eur(dDeel2.pool)}</b>. Zonder plafond zou jouw aandeel <b style={{ color: '#8b96a8', fontVariantNumeric: 'tabular-nums' }}>{eur(dDeel2.onbegrensd)}</b> zijn (20% van die pool), je eigen commissie die maand is <b style={{ color: '#8b96a8', fontVariantNumeric: 'tabular-nums' }}>{eur(dDeel2.plafond)}</b>, dus je krijgt het laagste van de twee.
            </div>
            <div style={{ fontSize: 14, color: '#8b96a8', marginTop: 4 }}>
              Cumulatief over 5 jaar: <b style={{ color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>{eur(cumDeel2)}</b>. Opgeteld bij wat je zelf aan eigen klanten verdient, komt jouw persoonlijke totaal op <b style={{ color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>{eur(cumDeel2 + cum5jrEigen)}</b>.
            </div>
          </div>
        </section>

        <footer style={{ fontSize: 12, color: '#5b6576', lineHeight: 1.6, borderTop: '1px solid #2d3a4d', paddingTop: 20 }}>
          Dit is een rekenvoorbeeld om je eigen situatie mee te verkennen, geen garantie of toezegging. Gebaseerd op het ArnoBot Team-tarief (platformtarief plus een bedrag per gebruiker, vanaf 3 gebruikers) en een aangenomen, gelijkmatig churn-percentage, niet op werkelijke opzeggingen.
        </footer>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8b96a8', fontWeight: 600, marginBottom: 10 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>{children}</div>
    </div>
  )
}

function NumberInput({ value, onChange, min, max, step, width }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; width?: number }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(Math.max(min ?? 0, parseFloat(e.target.value) || 0))}
      style={{ width: width ?? 76, background: '#1f2937', border: '1.5px solid #2d3a4d', borderRadius: 8, color: '#f1f5f9', fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', padding: '8px 10px', fontFamily: 'inherit' }}
    />
  )
}

function Unit({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#5b6576', fontSize: 13 }}>{children}</span>
}

function QsTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: '#1a2333', border: '1px solid #2d3a4d', borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8b96a8', fontWeight: 600 }}>{label}</span>
      <span style={{ display: 'block', fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', marginTop: 6 }}>{value}</span>
      <span style={{ display: 'block', fontSize: 12, color: '#5b6576', marginTop: 4 }}>{sub}</span>
    </div>
  )
}

function Legend({ items, withLine }: { items: [string, string][]; withLine?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 14, fontSize: 12, color: '#8b96a8' }}>
      {items.map(([color, label]) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
          {label}
        </span>
      ))}
      {withLine && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 14, height: 2, background: '#f1f5f9', display: 'inline-block' }} />
          Cumulatief (rechteras)
        </span>
      )}
    </div>
  )
}
