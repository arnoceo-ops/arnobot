'use client'

import { useEffect, useState } from 'react'
import { datumPlusDagen } from '@/lib/amsterdamTijd'
import { SorteerKop, useSortering } from './sorteerTabel'

// Tab Gebruikers: wat elke gebruiker over een periode (Amsterdamse kalenderdagen) aan AI en spraak kost, uit /api/kosten-per-gebruiker.
// Alleen wat gemeten wordt (arnobot_ai_gebruik, sinds 2026-11-19, en ElevenLabs-tekens). Met namen, besluit Arno 2026-11-19.

type BronRij = { bron: string; usd: number; aanroepen: number }
type Gebruiker = {
  userId: string
  naam: string
  email: string | null
  plan: string | null
  betaald: boolean
  actief: boolean
  /** Laatste abonnement uit arnobot_subscriptions, bijvoorbeeld "Pro jaarlijks, actief". Leeg bij een gebruiker in zijn proef. */
  abonnement: string | null
  /** Netto omzet (zonder btw) over de periode in centen, een jaarbetaling gespreid over 12 maanden, naar rato van de dagen. */
  omzetCent: number
  testaccount: boolean
  berichten: number
  /** Berichten vanaf het begin van de meting: alleen daarvoor zijn kosten bekend. Niet getoond (besluit Arno 2026-11-26), wel de deler van Per chatbericht. */
  gemetenBerichten: number
  totaalUsd: number
  anthropicUsd: number
  voyageUsd: number
  audioUsd: number
  voiceUsd: number
  zonderPrijs: number
  perBron: BronRij[]
}
type Antwoord = {
  periodeVolledigGemeten: boolean
  testers: { aantal: number; totaalUsd: number; berichten: number }
  van: string
  tot: string
  vandaag: string
  fxEurUsd: number
  gebruikers: Gebruiker[]
}

const fmtUsd = (n: number) => '$' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtUsd3 = (n: number) => '$' + n.toLocaleString('nl-NL', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fmtEur = (n: number) => '€' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDatum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

type Snelkeuze = 'deze-maand' | 'vorige-maand' | '7-dagen' | '30-dagen' | 'eigen'
const SNELKEUZES: { id: Snelkeuze; label: string }[] = [
  { id: 'deze-maand', label: 'Deze maand' },
  { id: 'vorige-maand', label: 'Vorige maand' },
  { id: '7-dagen', label: 'Laatste 7 dagen' },
  { id: '30-dagen', label: 'Laatste 30 dagen' },
  { id: 'eigen', label: 'Eigen periode' },
]

// Van en tot en met voor een snelkeuze, uit de datum van vandaag (Amsterdam, van de server).
function periodeVoorSnelkeuze(keuze: Snelkeuze, vandaag: string): { van: string; tot: string } | null {
  const eersteDezeMaand = `${vandaag.slice(0, 8)}01`
  switch (keuze) {
    case 'deze-maand': return { van: eersteDezeMaand, tot: vandaag }
    case 'vorige-maand': { const laatste = datumPlusDagen(eersteDezeMaand, -1); return { van: `${laatste.slice(0, 8)}01`, tot: laatste } }
    case '7-dagen': return { van: datumPlusDagen(vandaag, -6), tot: vandaag }
    case '30-dagen': return { van: datumPlusDagen(vandaag, -29), tot: vandaag }
    default: return null
  }
}
const PLAN_LABEL: Record<string, string> = { basis: 'Basic', premium: 'Pro', team: 'Team' }

type GebruikerKolom = 'naam' | 'plan' | 'berichten' | 'anthropic' | 'voyage' | 'audio' | 'voice' | 'totaal' | 'abonnement' | 'omzet' | 'marge'
const GEBRUIKER_KOLOMMEN: { kolom: GebruikerKolom; label: string; tekst?: boolean }[] = [
  { kolom: 'naam', label: 'Gebruiker', tekst: true }, { kolom: 'plan', label: 'Plan', tekst: true }, { kolom: 'berichten', label: 'Berichten' },
  { kolom: 'anthropic', label: 'Anthropic' }, { kolom: 'voyage', label: 'Voyage' }, { kolom: 'audio', label: 'Audio' }, { kolom: 'voice', label: 'Voice' }, { kolom: 'totaal', label: 'Totaal' },
  { kolom: 'abonnement', label: 'Abonnement', tekst: true }, { kolom: 'omzet', label: 'Omzet' }, { kolom: 'marge', label: 'Marge' },
]
type SoortKolom = 'soort' | 'dollars' | 'euro'
type BronKolom = 'bron' | 'aanroepen' | 'dollars'
const BRON_WAARDEN = { bron: (b: BronRij) => b.bron, aanroepen: (b: BronRij) => b.aanroepen, dollars: (b: BronRij) => b.usd }

const cardStyle: React.CSSProperties = { background: '#1a2333', border: '1px solid #2d3a4f', borderRadius: 12, padding: '20px 22px', marginBottom: 18 }
const cardHeadStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }
const dotStyle: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }
const selectStyle: React.CSSProperties = { background: '#1f2937', border: '1.5px solid #2d3a4f', borderRadius: 6, color: '#f1f5f9', padding: '7px 10px', fontSize: 13.5 }
const th: React.CSSProperties = { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #2d3a4f' }
const td: React.CSSProperties = { fontSize: 13.5, padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #222d3f' }
const statLabel: React.CSSProperties = { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }
const statValue: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }

export default function GebruikersKostenClient() {
  // Lege van en tot betekent: de standaard van de server (deze maand tot en met vandaag).
  const [periode, setPeriode] = useState<{ van: string; tot: string }>({ van: '', tot: '' })
  const [snelkeuze, setSnelkeuze] = useState<Snelkeuze>('deze-maand')
  const [data, setData] = useState<Antwoord | null>(null)
  const [fout, setFout] = useState('')
  const [laden, setLaden] = useState(true)
  const [gekozen, setGekozen] = useState<string>('')
  const gebruikerSortering = useSortering<GebruikerKolom>()
  const soortSortering = useSortering<SoortKolom>()
  const bronSortering = useSortering<BronKolom>()

  useEffect(() => {
    let actueel = true
    const query = periode.van && periode.tot ? `?van=${periode.van}&tot=${periode.tot}` : ''
    fetch(`/api/kosten-per-gebruiker${query}`)
      .then(async res => {
        if (res.status === 401) throw new Error('Sessie verlopen, log opnieuw in.')
        if (!res.ok) throw new Error('Ophalen mislukt.')
        return res.json() as Promise<Antwoord>
      })
      .then(d => { if (actueel) { setData(d); setFout(''); setLaden(false) } })
      .catch(e => { if (actueel) { setFout((e as Error).message); setLaden(false) } })
    return () => { actueel = false }
  }, [periode])

  function kiesSnelkeuze(keuze: Snelkeuze) {
    setSnelkeuze(keuze)
    if (keuze === 'eigen' || !data) return
    const p = periodeVoorSnelkeuze(keuze, data.vandaag)
    if (p) { setLaden(true); setPeriode(p) }
  }

  function zetDatum(veld: 'van' | 'tot', waarde: string) {
    setSnelkeuze('eigen')
    const volgende = { ...(periode.van && periode.tot ? periode : { van: data?.van ?? '', tot: data?.tot ?? '' }), [veld]: waarde }
    if (volgende.van && volgende.tot) { setLaden(true); setPeriode(volgende) }
  }

  if (fout) return <p style={{ color: '#cc2200', fontSize: 13 }}>{fout}</p>
  if (!data) return <p style={{ color: '#94a3b8', fontSize: 14 }}>Laden...</p>

  const eur = (usd: number) => usd / data.fxEurUsd
  const gebruiker = data.gebruikers.find(g => g.userId === gekozen) ?? null
  const totaalUsd = data.gebruikers.reduce((s, g) => s + g.totaalUsd, 0)
  // Geen aangenomen prijs: wat iemand betaalt hangt af van proef, cyclus, korting en tegoed. We tonen het echte abonnement en de echte betaling.
  const statusTekst = (g: Gebruiker) => g.abonnement ?? (g.actief ? 'gratis toegang' : 'inactief')
  const omzetTekst = (g: Gebruiker) => (g.omzetCent > 0 ? fmtEur(g.omzetCent / 100) : '-')
  // Marge alleen als de hele periode gemeten is en er omzet is: anders staat er omzet over de hele periode tegenover kosten van een deel ervan.
  const margeEur = (g: Gebruiker): number | null => (data.periodeVolledigGemeten && g.omzetCent > 0 ? g.omzetCent / 100 - eur(g.totaalUsd) : null)
  const periodeTekst = data.van === data.tot ? fmtDatum(data.van) : `${fmtDatum(data.van)} t/m ${fmtDatum(data.tot)}`
  const margeTekst = (g: Gebruiker) => { const m = margeEur(g); return m === null ? '-' : fmtEur(m) }

  const gebruikerRijen = gebruikerSortering.sorteer(data.gebruikers, {
    naam: g => g.naam,
    plan: g => PLAN_LABEL[g.plan ?? ''] ?? null,
    berichten: g => g.berichten,
    anthropic: g => g.anthropicUsd,
    voyage: g => g.voyageUsd,
    audio: g => g.audioUsd,
    voice: g => g.voiceUsd,
    totaal: g => g.totaalUsd,
    abonnement: statusTekst,
    omzet: g => (g.omzetCent > 0 ? g.omzetCent : null),
    marge: margeEur,
  })
  return (
    <div style={{ opacity: laden ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <label style={{ fontSize: 12, color: '#6b7280' }}>Periode</label>
        <select value={snelkeuze} onChange={e => kiesSnelkeuze(e.target.value as Snelkeuze)} style={selectStyle}>
          {SNELKEUZES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <label style={{ fontSize: 12, color: '#6b7280' }}>Van</label>
        <input type="date" value={data.van} max={data.tot} onChange={e => e.target.value && zetDatum('van', e.target.value)} style={selectStyle} />
        <label style={{ fontSize: 12, color: '#6b7280' }}>Tot en met</label>
        <input type="date" value={data.tot} min={data.van} max={data.vandaag} onChange={e => e.target.value && zetDatum('tot', e.target.value)} style={selectStyle} />
        <label style={{ fontSize: 12, color: '#6b7280' }}>Gebruiker</label>
        <select value={gekozen} onChange={e => setGekozen(e.target.value)} style={{ ...selectStyle, minWidth: 260 }}>
          <option value="">Alle gebruikers</option>
          {data.gebruikers.map(g => <option key={g.userId} value={g.userId}>{g.naam}{g.testaccount ? ' (testaccount)' : ''} · {fmtUsd(g.totaalUsd)}</option>)}
        </select>
      </div>

      {gebruiker ? (
        <div style={cardStyle}>
          <div style={cardHeadStyle}><span style={dotStyle} />{gebruiker.naam}{gebruiker.testaccount ? ' (testaccount)' : ''}</div>
          <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
            {gebruiker.email ?? 'geen e-mail'} · plan {PLAN_LABEL[gebruiker.plan ?? ''] ?? 'onbekend'} · {gebruiker.berichten} chatberichten in de periode
          </p>
          <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', marginBottom: 18 }}>
            <div><div style={statLabel}>Totaal</div><div style={{ ...statValue, color: '#f59e0b' }}>{fmtUsd(gebruiker.totaalUsd)}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>{fmtEur(eur(gebruiker.totaalUsd))}</div></div>
            <div><div style={statLabel}>Per chatbericht</div><div style={statValue}>{gebruiker.gemetenBerichten ? fmtUsd3(gebruiker.totaalUsd / gebruiker.gemetenBerichten) : '-'}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>alles meegerekend</div></div>
            <div><div style={statLabel}>Abonnement</div><div style={{ ...statValue, fontSize: 16 }}>{statusTekst(gebruiker)}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>uit de betaaladministratie</div></div>
            <div><div style={statLabel}>Omzet in de periode</div><div style={statValue}>{omzetTekst(gebruiker)}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>netto zonder btw, jaarbetaling gedeeld door 12</div></div>
            <div><div style={statLabel}>Marge</div><div style={{ ...statValue, color: (margeEur(gebruiker) ?? 0) < 0 ? '#cc4444' : '#44cc88' }}>{margeTekst(gebruiker)}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>omzet min kosten</div></div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
            <thead>
              <tr>
                <SorteerKop kolom="soort" label="Soort" tekst stijl={th} sortering={soortSortering.sortering} onKlik={soortSortering.klik} />
                <SorteerKop kolom="dollars" label="Dollars" stijl={th} sortering={soortSortering.sortering} onKlik={soortSortering.klik} />
                <SorteerKop kolom="euro" label="Euro" stijl={th} sortering={soortSortering.sortering} onKlik={soortSortering.klik} />
              </tr>
            </thead>
            <tbody>
              {soortSortering.sorteer(
                [
                  { label: 'Anthropic (chat, geheugen, analyses)', usd: gebruiker.anthropicUsd }, { label: 'Voyage (zoeken)', usd: gebruiker.voyageUsd },
                  { label: 'Audio (dicteren, bijlagen)', usd: gebruiker.audioUsd }, { label: 'Voice (ElevenLabs)', usd: gebruiker.voiceUsd },
                ],
                { soort: r => r.label, dollars: r => r.usd, euro: r => r.usd },
              ).map(({ label, usd }) => (
                <tr key={label}><td style={{ ...td, textAlign: 'left' }}>{label}</td><td style={td}>{fmtUsd3(usd)}</td><td style={td}>{fmtEur(eur(usd))}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...cardHeadStyle, marginBottom: 8 }}>Per bron</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <SorteerKop kolom="bron" label="Bron" tekst stijl={th} sortering={bronSortering.sortering} onKlik={bronSortering.klik} />
                <SorteerKop kolom="aanroepen" label="Aanroepen" stijl={th} sortering={bronSortering.sortering} onKlik={bronSortering.klik} />
                <SorteerKop kolom="dollars" label="Dollars" stijl={th} sortering={bronSortering.sortering} onKlik={bronSortering.klik} />
              </tr>
            </thead>
            <tbody>
              {bronSortering.sorteer(gebruiker.perBron, BRON_WAARDEN).map(b => <tr key={b.bron}><td style={{ ...td, textAlign: 'left' }}>{b.bron}</td><td style={td}>{b.aanroepen}</td><td style={td}>{fmtUsd3(b.usd)}</td></tr>)}
              {gebruiker.perBron.length === 0 && <tr><td style={{ ...td, textAlign: 'left', color: '#6b7280' }} colSpan={3}>Geen kosten voor deze gebruiker in deze periode.</td></tr>}
            </tbody>
          </table>
          {gebruiker.zonderPrijs > 0 && <p style={{ fontSize: 12, color: '#f59e0b', marginTop: 10 }}>{gebruiker.zonderPrijs} aanroepen zonder bekend tarief staan op nul.</p>}
        </div>
      ) : (
        <div style={cardStyle}>
          <div style={cardHeadStyle}><span style={dotStyle} />Alle gebruikers, {periodeTekst}</div>
          <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
            Totaal: {fmtUsd(totaalUsd)} ({fmtEur(eur(totaalUsd))}) over {data.gebruikers.length} gebruikers.
            Omzet is netto zonder btw, een jaarbetaling gedeeld over 12 maanden en naar rato van de dagen in de periode.
          </p>
          {data.testers.aantal > 0 && (
            <p style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 14 }}>
              Niet getoond: {data.testers.aantal} testers en testaccounts ({data.testers.berichten} berichten), samen {fmtUsd(data.testers.totaalUsd)} aan kosten. Die tellen niet mee in het totaal hierboven, maar wel in de Anthropic-Console.
            </p>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
              <thead>
                <tr>
                  {GEBRUIKER_KOLOMMEN.map(k => <SorteerKop key={k.kolom} {...k} stijl={th} sortering={gebruikerSortering.sortering} onKlik={gebruikerSortering.klik} />)}
                </tr>
              </thead>
              <tbody>
                {gebruikerRijen.map(g => {
                  return (
                    <tr key={g.userId} onClick={() => setGekozen(g.userId)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...td, textAlign: 'left' }}>{g.naam}{g.testaccount ? <span style={{ color: '#6b7280' }}> (test)</span> : null}</td>
                      <td style={td}>{PLAN_LABEL[g.plan ?? ''] ?? '-'}</td>
                      <td style={td}>{g.berichten}</td>
                      <td style={td}>{fmtUsd(g.anthropicUsd)}</td>
                      <td style={td}>{fmtUsd(g.voyageUsd)}</td>
                      <td style={td}>{fmtUsd(g.audioUsd)}</td>
                      <td style={td}>{fmtUsd(g.voiceUsd)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmtUsd(g.totaalUsd)}</td>
                      <td style={{ ...td, textAlign: 'left', color: '#94a3b8', fontSize: 12.5 }}>{statusTekst(g)}</td>
                      <td style={td}>{omzetTekst(g)}</td>
                      <td style={{ ...td, color: (margeEur(g) ?? 0) < 0 ? '#cc4444' : '#94a3b8' }}>{margeTekst(g)}</td>
                    </tr>
                  )
                })}
                {data.gebruikers.length === 0 && <tr><td style={{ ...td, textAlign: 'left', color: '#6b7280' }} colSpan={11}>Geen gebruikers in deze periode.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
