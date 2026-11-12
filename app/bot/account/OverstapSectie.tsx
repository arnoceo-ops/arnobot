'use client'

import { useCallback, useEffect, useState } from 'react'
import { useIsNativeApp } from '@/hooks/useIsNativeApp'
import type { OverstapStatus } from '@/lib/billing/overstapStatus'

// Overstappen en intrekken op de accountpagina (docs/OVERSTAP_PLAN.md). De server bepaalt wat er te
// kiezen valt en wat het kost (GET /api/bot/billing); deze component toont alleen. Zolang de overstap niet
// openstaat voor iedereen (OVERSTAP_OPEN) komt er voor gewone gebruikers niets terug en blijft de pagina leeg.
// In de Android-app verborgen, net als andere koop- en upgradeverwijzingen (Google Play-betalingsbeleid).

interface BillingAntwoord {
  abonnement: { plan: 'basis' | 'premium'; cyclus: 'maandelijks' | 'jaarlijks'; klantType: 'particulier' | 'zakelijk' } | null
  overstap: OverstapStatus | null
}

const section: React.CSSProperties = { borderTop: '1px solid #374151', paddingTop: '32px', marginBottom: '48px' }
const label: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: '13px', letterSpacing: '4px', marginBottom: '16px', display: 'block' }
const body: React.CSSProperties = { fontWeight: 400, color: '#9ca3af', fontSize: '15px', lineHeight: '1.9', marginBottom: '24px' }
const btn: React.CSSProperties = { padding: '12px 36px', border: 'none', background: '#f59e0b', color: '#111827', fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', letterSpacing: '3px', cursor: 'pointer', transition: 'background 0.2s', borderRadius: '999px', display: 'inline-block', minWidth: '260px', textAlign: 'center' }
const btnUit: React.CSSProperties = { ...btn, background: 'transparent', color: '#9ca3af', border: '1px solid #374151' }
const foutStijl: React.CSSProperties = { color: '#cc2200', fontSize: '14px', letterSpacing: '1px', lineHeight: 1.6, marginTop: '16px' }
const klaarStijl: React.CSSProperties = { color: '#f59e0b', fontSize: '13px', letterSpacing: '2px', marginBottom: '48px' }

const datumNl = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
const euro = (cent: number) => `€${(cent / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** `versie` ophogen laadt de gegevens opnieuw, bijvoorbeeld nadat de pagina zelf het abonnement heeft opgezegd. */
function useBilling(versie = 0) {
  const [data, setData] = useState<BillingAntwoord | null>(null)
  const laad = useCallback(() => {
    fetch('/api/bot/billing', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: BillingAntwoord) => setData(d))
      .catch(() => {})
  }, [])
  useEffect(() => { laad() }, [laad, versie])
  return { data, laad }
}

async function post(pad: string, body?: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

function Akkoord({ aan, zet }: { aan: boolean; zet: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: '#94a3b8', lineHeight: 1.5, cursor: 'pointer', marginBottom: 20, maxWidth: 520 }}>
      <input type="checkbox" checked={aan} onChange={e => zet(e.target.checked)} style={{ marginTop: 3, accentColor: '#f59e0b', width: 'auto', flex: 'none' }} />
      <span>Ik ga akkoord met de <a href="/voorwaarden" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>algemene voorwaarden</a> en heb de <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>privacyverklaring</a> gelezen.</span>
    </label>
  )
}

export default function OverstapSectie({ versie = 0 }: { versie?: number }) {
  const isNativeApp = useIsNativeApp()
  const { data, laad } = useBilling(versie)
  const [open, setOpen] = useState<'jaar' | 'upgrade' | null>(null)
  const [akkoord, setAkkoord] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [klaar, setKlaar] = useState<string | null>(null)

  const o = data?.overstap
  const ab = data?.abonnement
  if (isNativeApp || !o || !ab) return klaar && !isNativeApp ? <p style={klaarStijl}>✓ {klaar}</p> : null
  if (!o.naarJaar && !o.upgrade && !o.gepland && !klaar) return null

  function sluit() { setOpen(null); setAkkoord(false); setFout(null) }

  async function stapOverOpJaar() {
    if (!ab) return
    setBezig(true); setFout(null)
    try {
      const r = await post('/api/bot/billing/overstappen', { plan: ab.plan, cyclus: 'jaarlijks', akkoordVoorwaarden: true })
      if (!r.ok) { setFout(String(r.data.error ?? 'Overstappen is niet gelukt.')); return }
      sluit()
      setKlaar(`Je stapt over op ${datumNl(String(r.data.ingaatOp))}.`)
      laad()
    } catch { setFout('Overstappen is niet gelukt. Probeer het zo opnieuw.') } finally { setBezig(false) }
  }

  async function upgrade() {
    setBezig(true); setFout(null)
    try {
      const r = await post('/api/bot/billing/upgrade', { akkoordVoorwaarden: true })
      if (!r.ok) { setFout(String(r.data.error ?? 'Upgraden is niet gelukt.')); return }
      sluit()
      const direct = (r.data.upgrade as { direct?: boolean } | undefined)?.direct
      setKlaar(direct ? 'Je hebt nu Pro.' : `Je stapt over op Pro per ${datumNl(String(r.data.ingaatOp))}.`)
      laad()
    } catch { setFout('Upgraden is niet gelukt. Probeer het zo opnieuw.') } finally { setBezig(false) }
  }

  async function trekIn() {
    setBezig(true); setFout(null)
    try {
      const r = await post('/api/bot/billing/overstap-intrekken')
      if (!r.ok) { setFout(String(r.data.error ?? 'Intrekken is niet gelukt.')); return }
      setKlaar('Je overstap is ingetrokken.')
      laad()
    } catch { setFout('Intrekken is niet gelukt. Probeer het zo opnieuw.') } finally { setBezig(false) }
  }

  const btwTekst = (zakelijk: boolean) => (zakelijk ? ' excl. BTW' : '')

  return (
    <>
      {klaar && <p style={klaarStijl}>✓ {klaar}</p>}

      {o.gepland && (
        <div style={section}>
          <p style={label}>OVERSTAP</p>
          <p style={body}>Je stapt over op {datumNl(o.gepland.ingaatOp)}.</p>
          <button onClick={trekIn} disabled={bezig} style={{ ...btnUit, cursor: bezig ? 'not-allowed' : 'pointer' }}>
            {bezig ? 'VERWERKEN...' : 'INTREKKEN'}
          </button>
          {fout && <p style={foutStijl}>{fout}</p>}
        </div>
      )}

      {o.naarJaar && (
        <div style={section}>
          <p style={label}>PER JAAR BETALEN</p>
          <p style={body}>Betaal per jaar en je bespaart €{o.naarJaar.besparingEuro} per jaar.</p>
          {open !== 'jaar' ? (
            <button onClick={() => { sluit(); setOpen('jaar') }} style={btn}>STAP OVER OP JAAR</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 520 }}>
              <p style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
                Vanaf {datumNl(o.naarJaar.ingaatOp)} betaal je €{o.naarJaar.jaarbedragEuro}{btwTekst(o.naarJaar.zakelijk)} per jaar in plaats van €{o.naarJaar.maandbedragEuro}{btwTekst(o.naarJaar.zakelijk)} per maand. Tot die datum verandert er niets. Je kunt dit tot een dag van tevoren intrekken.
                {o.naarJaar.zakelijk && ' Een jaarabonnement heeft een opzegtermijn van één maand voor het einde van het jaar.'}
              </p>
              <Akkoord aan={akkoord} zet={setAkkoord} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <button onClick={stapOverOpJaar} disabled={!akkoord || bezig} style={{ ...btn, background: akkoord && !bezig ? '#f59e0b' : '#374151', color: akkoord && !bezig ? '#111827' : '#6b7280', cursor: akkoord && !bezig ? 'pointer' : 'not-allowed' }}>
                  {bezig ? 'VERWERKEN...' : 'JA, OVERSTAPPEN'}
                </button>
                <button onClick={sluit} style={btnUit}>ANNULEREN</button>
              </div>
            </div>
          )}
          {fout && open === 'jaar' && <p style={foutStijl}>{fout}</p>}
        </div>
      )}

      {o.upgrade && (
        <div style={section}>
          <p style={label}>PRO NU</p>
          <p style={body}>
            {o.upgrade.bijbetalingCent > 0
              ? `Upgrade naar Pro en je hebt Pro meteen. Je betaalt nu ${euro(o.upgrade.bijbetalingCent)}${btwTekst(o.upgrade.zakelijk)} bij voor de rest van deze periode, daarna het Pro-bedrag.`
              : 'Upgrade naar Pro en je hebt Pro meteen. Er is nu niets bij te betalen.'}
          </p>
          {open !== 'upgrade' ? (
            <button onClick={() => { sluit(); setOpen('upgrade') }} style={btn}>UPGRADE NAAR PRO</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 520 }}>
              <Akkoord aan={akkoord} zet={setAkkoord} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <button onClick={upgrade} disabled={!akkoord || bezig} style={{ ...btn, background: akkoord && !bezig ? '#f59e0b' : '#374151', color: akkoord && !bezig ? '#111827' : '#6b7280', cursor: akkoord && !bezig ? 'pointer' : 'not-allowed' }}>
                  {bezig ? 'VERWERKEN...' : 'JA, UPGRADEN'}
                </button>
                <button onClick={sluit} style={btnUit}>ANNULEREN</button>
              </div>
            </div>
          )}
          {fout && open === 'upgrade' && <p style={foutStijl}>{fout}</p>}
        </div>
      )}
    </>
  )
}

/** Knop om een opzegging in te trekken, onder de tekst "Je opzegging is ontvangen". */
export function OpzeggingIntrekken({ onIngetrokken }: { onIngetrokken: () => void }) {
  const isNativeApp = useIsNativeApp()
  const { data } = useBilling()
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  if (isNativeApp || !data?.overstap?.opzeggingIntrekbaar) return null

  async function trekIn() {
    setBezig(true); setFout(null)
    try {
      const r = await post('/api/bot/billing/opzegging-intrekken')
      if (!r.ok) { setFout(String(r.data.error ?? 'Intrekken is niet gelukt.')); return }
      onIngetrokken()
    } catch { setFout('Intrekken is niet gelukt. Probeer het zo opnieuw.') } finally { setBezig(false) }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={trekIn} disabled={bezig} style={{ ...btnUit, color: '#f59e0b', border: '1px solid #f59e0b', cursor: bezig ? 'not-allowed' : 'pointer' }}>
        {bezig ? 'VERWERKEN...' : 'OPZEGGING INTREKKEN'}
      </button>
      {fout && <p style={foutStijl}>{fout}</p>}
    </div>
  )
}
