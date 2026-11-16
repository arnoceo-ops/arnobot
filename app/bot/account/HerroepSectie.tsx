'use client'

import { useEffect, useState } from 'react'
import { useIsNativeApp } from '@/hooks/useIsNativeApp'

// Koop ongedaan maken binnen de bedenktijd van 14 dagen (voorwaarden artikel 8). De server bepaalt of er iets
// te herroepen valt en wat het bedrag is (GET /api/bot/billing/herroepen); deze component toont en vraagt een
// bevestiging. Tot HERROEPING_OPEN=true komt er voor gewone gebruikers niets terug en blijft de pagina leeg.
// In de Android-app verborgen, net als andere koop- en upgradeverwijzingen (Google Play-betalingsbeleid).

interface Antwoord {
  beschikbaar: boolean
  proef?: boolean
  herroepbaar: { soort: 'eerste' | 'upgrade'; bedragCent: number; uiterlijkTot: string; gesimuleerd: boolean } | null
}

const section: React.CSSProperties = { borderTop: '1px solid #374151', paddingTop: '32px', marginBottom: '48px' }
const label: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: '13px', letterSpacing: '4px', marginBottom: '16px', display: 'block' }
const body: React.CSSProperties = { fontWeight: 400, color: '#9ca3af', fontSize: '15px', lineHeight: '1.9', marginBottom: '24px' }
// Rand van 1px in dezelfde kleur, zodat de knop even breed is als de opzegknop (die heeft een rand van 1px).
const btn: React.CSSProperties = { padding: '12px 36px', border: '1px solid #f59e0b', background: '#f59e0b', color: '#111827', fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', letterSpacing: '3px', cursor: 'pointer', transition: 'background 0.2s', borderRadius: '999px', display: 'inline-block', minWidth: '260px', textAlign: 'center' }
const btnUit: React.CSSProperties = { ...btn, background: 'transparent', color: '#9ca3af', border: '1px solid #374151' }
const foutStijl: React.CSSProperties = { color: '#cc2200', fontSize: '14px', letterSpacing: '1px', lineHeight: 1.6, marginTop: '16px' }
const klaarStijl: React.CSSProperties = { color: '#f59e0b', fontSize: '13px', letterSpacing: '2px', lineHeight: 1.8, marginBottom: '48px' }
const proefStijl: React.CSSProperties = { color: '#6b7280', fontSize: '12px', letterSpacing: '2px', lineHeight: 1.6, marginBottom: '16px' }

const datumNl = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
const euro = (cent: number) => `€${(cent / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function HerroepSectie() {
  const isNativeApp = useIsNativeApp()
  const [data, setData] = useState<Antwoord | null>(null)
  const [bevestig, setBevestig] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [klaar, setKlaar] = useState<{ proef: boolean; soort: 'eerste' | 'upgrade' } | null>(null)

  useEffect(() => {
    fetch('/api/bot/billing/herroepen', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: Antwoord) => setData(d))
      .catch(() => {})
  }, [])

  if (isNativeApp) return null

  if (klaar) {
    return (
      <p style={klaarStijl}>
        ✓ Gelukt. Je krijgt een bevestiging per e-mail. Het bedrag komt terug op de rekening waarmee je betaalde.
        {klaar.soort === 'eerste' && !klaar.proef && <><br />Je abonnement is gestopt en je toegang eindigt nu. Je gegevens kun je nog 30 dagen opvragen via hq@arno.bot.</>}
        {klaar.proef && <><br /><span style={{ color: '#6b7280' }}>PROEFMODUS: er is niets echt terugbetaald.</span></>}
      </p>
    )
  }

  const h = data?.herroepbaar
  if (!data?.beschikbaar || !h) return null
  const upgrade = h.soort === 'upgrade'

  async function ongedaanMaken() {
    setBezig(true); setFout(null)
    try {
      const res = await fetch('/api/bot/billing/herroepen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bevestigd: true }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFout(String(d.error ?? 'Ongedaan maken is niet gelukt.')); return }
      setKlaar({ proef: d.proef === true, soort: h!.soort })
    } catch { setFout('Ongedaan maken is niet gelukt. Probeer het zo opnieuw.') } finally { setBezig(false) }
  }

  return (
    <div style={section}>
      <p style={label}>BEDENKTIJD</p>
      {h.gesimuleerd && <p style={proefStijl}>PROEFMODUS (alleen zichtbaar voor testaccounts): er wordt niets echt terugbetaald.</p>}
      <p style={body}>
        Je hebt tot en met {datumNl(h.uiterlijkTot)} bedenktijd. Maak {upgrade ? 'je upgrade' : 'je aankoop'} ongedaan en je krijgt je geld terug.
      </p>
      {!bevestig ? (
        <button onClick={() => { setBevestig(true); setFout(null) }} style={btn}>KOOP ONGEDAAN MAKEN</button>
      ) : (
        <>
          <p style={body}>
            Je krijgt {euro(h.bedragCent)} terug. {upgrade ? 'Je upgrade wordt teruggedraaid en je abonnement loopt door.' : 'Je abonnement stopt direct en je toegang eindigt.'}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={ongedaanMaken} disabled={bezig} style={{ ...btn, cursor: bezig ? 'not-allowed' : 'pointer' }}>
              {bezig ? 'VERWERKEN...' : 'JA, ONGEDAAN MAKEN'}
            </button>
            <button onClick={() => { setBevestig(false); setFout(null) }} disabled={bezig} style={btnUit}>NEE, BEHOUDEN</button>
          </div>
        </>
      )}
      {fout && <p style={foutStijl}>{fout}</p>}
    </div>
  )
}
