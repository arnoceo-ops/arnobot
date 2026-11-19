'use client'

import { useEffect, useState } from 'react'

// Tab Gebruikers: wat elke gebruiker in een kalendermaand (Amsterdamse tijd) aan AI en spraak kost, uit /api/kosten-per-gebruiker.
// Alleen wat gemeten wordt (arnobot_ai_gebruik, sinds 2026-11-19, en ElevenLabs-tekens). Met namen, besluit Arno 2026-11-19.

type BronRij = { bron: string; usd: number; aanroepen: number }
type Gebruiker = {
  userId: string
  naam: string
  email: string | null
  plan: string | null
  testaccount: boolean
  berichten: number
  /** Berichten vanaf het begin van de meting: alleen daarvoor zijn kosten bekend. */
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
  meetStart: string | null
  maand: string
  maanden: string[]
  fxEurUsd: number
  referentiePrijsEur: Record<string, number>
  gebruikers: Gebruiker[]
  platform: { totaalUsd: number; perBron: BronRij[] }
}

const fmtUsd = (n: number) => '$' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtUsd3 = (n: number) => '$' + n.toLocaleString('nl-NL', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fmtEur = (n: number) => '€' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtMaand = (m: string) => new Date(m + '-15T12:00:00Z').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const PLAN_LABEL: Record<string, string> = { basis: 'Basic', premium: 'Pro', team: 'Team' }

const cardStyle: React.CSSProperties = { background: '#1a2333', border: '1px solid #2d3a4f', borderRadius: 12, padding: '20px 22px', marginBottom: 18 }
const cardHeadStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }
const dotStyle: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }
const selectStyle: React.CSSProperties = { background: '#1f2937', border: '1.5px solid #2d3a4f', borderRadius: 6, color: '#f1f5f9', padding: '7px 10px', fontSize: 13.5 }
const th: React.CSSProperties = { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #2d3a4f' }
const td: React.CSSProperties = { fontSize: 13.5, padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #222d3f' }
const statLabel: React.CSSProperties = { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }
const statValue: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }

export default function GebruikersKostenClient() {
  const [maand, setMaand] = useState<string>('')
  const [data, setData] = useState<Antwoord | null>(null)
  const [fout, setFout] = useState('')
  const [laden, setLaden] = useState(true)
  const [gekozen, setGekozen] = useState<string>('')

  useEffect(() => {
    let actueel = true
    fetch(`/api/kosten-per-gebruiker${maand ? `?maand=${maand}` : ''}`)
      .then(async res => {
        if (res.status === 401) throw new Error('Sessie verlopen, log opnieuw in.')
        if (!res.ok) throw new Error('Ophalen mislukt.')
        return res.json() as Promise<Antwoord>
      })
      .then(d => { if (actueel) { setData(d); setFout(''); setLaden(false); if (!maand) setMaand(d.maand) } })
      .catch(e => { if (actueel) { setFout((e as Error).message); setLaden(false) } })
    return () => { actueel = false }
  }, [maand])

  if (fout) return <p style={{ color: '#cc2200', fontSize: 13 }}>{fout}</p>
  if (!data) return <p style={{ color: '#94a3b8', fontSize: 14 }}>Laden...</p>

  const eur = (usd: number) => usd / data.fxEurUsd
  const gebruiker = data.gebruikers.find(g => g.userId === gekozen) ?? null
  const totaalUsd = data.gebruikers.reduce((s, g) => s + g.totaalUsd, 0)
  const prijs = (g: Gebruiker) => data.referentiePrijsEur[g.plan ?? 'basis'] ?? 19
  const meetStartTekst = data.meetStart
    ? new Date(data.meetStart).toLocaleString('nl-NL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
    : 'nog niet'

  return (
    <div style={{ opacity: laden ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <label style={{ fontSize: 12, color: '#6b7280' }}>Maand</label>
        <select value={maand || data.maand} onChange={e => { setLaden(true); setMaand(e.target.value) }} style={selectStyle}>
          {data.maanden.map(m => <option key={m} value={m}>{fmtMaand(m)}</option>)}
        </select>
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
            {gebruiker.email ?? 'geen e-mail'} · plan {PLAN_LABEL[gebruiker.plan ?? ''] ?? 'onbekend'} · {gebruiker.berichten} chatberichten in {fmtMaand(data.maand)}, waarvan {gebruiker.gemetenBerichten} vanaf het begin van de meting ({meetStartTekst})
          </p>
          <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', marginBottom: 18 }}>
            <div><div style={statLabel}>Totaal</div><div style={{ ...statValue, color: '#f59e0b' }}>{fmtUsd(gebruiker.totaalUsd)}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>{fmtEur(eur(gebruiker.totaalUsd))}</div></div>
            <div><div style={statLabel}>Per chatbericht</div><div style={statValue}>{gebruiker.gemetenBerichten ? fmtUsd3(gebruiker.totaalUsd / gebruiker.gemetenBerichten) : '-'}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>alles meegerekend, over {gebruiker.gemetenBerichten} gemeten berichten</div></div>
            <div><div style={statLabel}>Referentieomzet</div><div style={statValue}>{fmtEur(prijs(gebruiker))}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>jaarprijs per maand</div></div>
            <div><div style={statLabel}>Marge</div><div style={{ ...statValue, color: prijs(gebruiker) - eur(gebruiker.totaalUsd) < 0 ? '#cc4444' : '#44cc88' }}>{gebruiker.gemetenBerichten > 0 || gebruiker.totaalUsd > 0 ? fmtEur(prijs(gebruiker) - eur(gebruiker.totaalUsd)) : '-'}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>na AI en spraak, alleen gemeten deel</div></div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Soort</th><th style={th}>Dollars</th><th style={th}>Euro</th></tr></thead>
            <tbody>
              {[['Anthropic (chat, geheugen, analyses)', gebruiker.anthropicUsd], ['Voyage (zoeken)', gebruiker.voyageUsd], ['Audio (dicteren, bijlagen)', gebruiker.audioUsd], ['Voice (ElevenLabs)', gebruiker.voiceUsd]].map(([label, usd]) => (
                <tr key={label as string}><td style={{ ...td, textAlign: 'left' }}>{label as string}</td><td style={td}>{fmtUsd3(usd as number)}</td><td style={td}>{fmtEur(eur(usd as number))}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...cardHeadStyle, marginBottom: 8 }}>Per bron</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Bron</th><th style={th}>Aanroepen</th><th style={th}>Dollars</th></tr></thead>
            <tbody>
              {gebruiker.perBron.map(b => <tr key={b.bron}><td style={{ ...td, textAlign: 'left' }}>{b.bron}</td><td style={td}>{b.aanroepen}</td><td style={td}>{fmtUsd3(b.usd)}</td></tr>)}
              {gebruiker.perBron.length === 0 && <tr><td style={{ ...td, textAlign: 'left', color: '#6b7280' }} colSpan={3}>Nog niets gemeten voor deze gebruiker in deze maand.</td></tr>}
            </tbody>
          </table>
          {gebruiker.zonderPrijs > 0 && <p style={{ fontSize: 12, color: '#f59e0b', marginTop: 10 }}>{gebruiker.zonderPrijs} aanroepen zonder bekend tarief staan op nul.</p>}
        </div>
      ) : (
        <div style={cardStyle}>
          <div style={cardHeadStyle}><span style={dotStyle} />Alle gebruikers, {fmtMaand(data.maand)}</div>
          <p style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
            Totaal gemeten: {fmtUsd(totaalUsd)} ({fmtEur(eur(totaalUsd))}) over {data.gebruikers.length} gebruikers, plus {fmtUsd(data.platform.totaalUsd)} platformwerk zonder gebruiker (crons, admin).
            De meting loopt sinds {meetStartTekst}: berichten van daarvoor tellen mee in Berichten, maar niet in de kosten. Kolom Gemeten telt alleen berichten vanaf dat moment.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>Gebruiker</th><th style={th}>Plan</th><th style={th}>Berichten</th><th style={th}>Gemeten</th>
                  <th style={th}>Anthropic</th><th style={th}>Voyage</th><th style={th}>Audio</th><th style={th}>Voice</th><th style={th}>Totaal</th><th style={th}>Marge ref.</th>
                </tr>
              </thead>
              <tbody>
                {data.gebruikers.map(g => {
                  const marge = prijs(g) - eur(g.totaalUsd)
                  return (
                    <tr key={g.userId} onClick={() => setGekozen(g.userId)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...td, textAlign: 'left' }}>{g.naam}{g.testaccount ? <span style={{ color: '#6b7280' }}> (test)</span> : null}</td>
                      <td style={td}>{PLAN_LABEL[g.plan ?? ''] ?? '-'}</td>
                      <td style={td}>{g.berichten}</td>
                      <td style={td}>{g.gemetenBerichten}</td>
                      <td style={td}>{fmtUsd(g.anthropicUsd)}</td>
                      <td style={td}>{fmtUsd(g.voyageUsd)}</td>
                      <td style={td}>{fmtUsd(g.audioUsd)}</td>
                      <td style={td}>{fmtUsd(g.voiceUsd)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmtUsd(g.totaalUsd)}</td>
                      <td style={{ ...td, color: marge < 0 ? '#cc4444' : '#94a3b8' }}>{g.plan && (g.gemetenBerichten > 0 || g.totaalUsd > 0) ? fmtEur(marge) : '-'}</td>
                    </tr>
                  )
                })}
                {data.gebruikers.length === 0 && <tr><td style={{ ...td, textAlign: 'left', color: '#6b7280' }} colSpan={10}>Nog niets gemeten in deze maand.</td></tr>}
              </tbody>
            </table>
          </div>
          {data.platform.perBron.length > 0 && (
            <>
              <div style={{ ...cardHeadStyle, margin: '20px 0 8px' }}>Platformwerk zonder gebruiker</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...th, textAlign: 'left' }}>Bron</th><th style={th}>Aanroepen</th><th style={th}>Dollars</th></tr></thead>
                <tbody>{data.platform.perBron.map(b => <tr key={b.bron}><td style={{ ...td, textAlign: 'left' }}>{b.bron}</td><td style={td}>{b.aanroepen}</td><td style={td}>{fmtUsd3(b.usd)}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}
