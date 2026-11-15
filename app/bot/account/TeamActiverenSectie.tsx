'use client'

import { useCallback, useEffect, useState } from 'react'
import { useIsNativeApp } from '@/hooks/useIsNativeApp'
import type { ActivatieStand } from '@/lib/teamActivatie'

// Teamproef omzetten naar een betaald Team, op de accountpagina van de manager (docs/TEAM_ONBOARDING.md,
// "Zelf activeren"). De server bepaalt wat er kan en wat het kost (GET /api/bot/team/activeren); deze
// component toont alleen. In de Android-app verborgen, net als andere koopverwijzingen (Google Play-beleid).

type Bedrag = { nettoCent: number; btwCent: number; brutoCent: number }
type Antwoord = { stand: ActivatieStand | null; bedrag: Bedrag | null; betalenBeschikbaar: boolean }

const section: React.CSSProperties = { borderTop: '1px solid #374151', paddingTop: '32px', marginBottom: '48px' }
const label: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontWeight: 400, color: '#f59e0b', fontSize: '13px', letterSpacing: '4px', marginBottom: '16px', display: 'block' }
const body: React.CSSProperties = { fontWeight: 400, color: '#9ca3af', fontSize: '15px', lineHeight: '1.9', marginBottom: '24px' }
const btn: React.CSSProperties = { padding: '12px 36px', border: 'none', background: '#f59e0b', color: '#111827', fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', letterSpacing: '3px', cursor: 'pointer', borderRadius: 0, display: 'inline-block', textDecoration: 'none' }
const btnUit: React.CSSProperties = { ...btn, background: 'transparent', color: '#9ca3af', border: '1px solid #374151' }
const veld: React.CSSProperties = { width: '100%', maxWidth: 420, padding: '10px 12px', background: '#1f2937', border: '1px solid #374151', color: '#f1f5f9', fontSize: 15, fontFamily: 'inherit', borderRadius: 0, boxSizing: 'border-box' }
const veldLabel: React.CSSProperties = { display: 'block', color: '#6b7280', fontSize: 12, letterSpacing: 2, margin: '16px 0 6px' }
const foutStijl: React.CSSProperties = { color: '#cc2200', fontSize: '14px', letterSpacing: '1px', lineHeight: 1.6, marginTop: '16px' }

const VELDEN = ['bedrijfsnaam', 'kvkNummer', 'btwNummer', 'straat', 'postcode', 'plaats'] as const
type VeldNaam = typeof VELDEN[number]

const euro = (cent: number) => `€${(cent / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const datumNl = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })

/** Laadt de teamstand van de manager. `stand` is null zolang het laden duurt of als deze gebruiker geen team beheert. */
export function useActivatieStand(): { stand: ActivatieStand | null; loaded: boolean; laad: () => void } {
  const [stand, setStand] = useState<ActivatieStand | null>(null)
  const [loaded, setLoaded] = useState(false)
  const laad = useCallback(() => {
    fetch('/api/bot/team/activeren', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: Antwoord | null) => { setStand(d?.stand ?? null) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])
  useEffect(() => { laad() }, [laad])
  return { stand, loaded, laad }
}

export default function TeamActiverenSectie({ stand, laad }: { stand: ActivatieStand | null; laad: () => void }) {
  const isNativeApp = useIsNativeApp()
  const [open, setOpen] = useState(false)
  // Wat de manager zelf typt; zolang er niets is getypt gelden het aantal leden (minimaal 3) en de bekende bedrijfsgegevens.
  const [seatsIngevuld, setSeats] = useState<string | null>(null)
  const [cyclus, setCyclus] = useState<'maandelijks' | 'jaarlijks'>('maandelijks')
  const [bewerkt, setBewerkt] = useState<Partial<Record<VeldNaam, string>>>({})
  const [akkoord, setAkkoord] = useState(false)
  const [bedrag, setBedrag] = useState<Bedrag | null>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [klaar, setKlaar] = useState<{ bedragCent: number; betaalLink: string | null } | null>(null)

  const seats = seatsIngevuld ?? String(Math.max(3, stand?.ledenAantal ?? 3))
  const f = Object.fromEntries(VELDEN.map(n => [n, bewerkt[n] ?? stand?.voorinvulling?.[n] ?? ''])) as Record<VeldNaam, string>

  // Het bedrag komt van de server (dezelfde berekening als de factuur), pas als de keuze geldig is.
  useEffect(() => {
    if (!open || !stand?.kanActiveren) return
    let geannuleerd = false
    fetch(`/api/bot/team/activeren?seats=${encodeURIComponent(seats)}&cyclus=${cyclus}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: Antwoord | null) => { if (!geannuleerd) setBedrag(d?.bedrag ?? null) })
      .catch(() => { if (!geannuleerd) setBedrag(null) })
    return () => { geannuleerd = true }
  }, [open, seats, cyclus, stand?.kanActiveren])

  if (isNativeApp || !stand) return null

  async function bevestig() {
    setBezig(true)
    setFout(null)
    try {
      const res = await fetch('/api/bot/team/activeren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seats: Number(seats), cyclus, ...f, akkoordVoorwaarden: akkoord }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Activeren mislukt')
      setKlaar({ bedragCent: d.bedragCent, betaalLink: d.betaalLink ?? null })
      setOpen(false)
      laad()
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Activeren mislukt')
    } finally {
      setBezig(false)
    }
  }

  const tekstVeld = (naam: VeldNaam, titel: string, plaatshouder?: string) => (
    <>
      <label style={veldLabel} htmlFor={`ta-${naam}`}>{titel}</label>
      <input id={`ta-${naam}`} style={veld} value={f[naam]} placeholder={plaatshouder} onChange={e => setBewerkt(h => ({ ...h, [naam]: e.target.value }))} />
    </>
  )

  // Na het activeren, of voor een geactiveerd team met een openstaande factuur: alleen de betaalknop.
  const betaalLink = klaar?.betaalLink ?? stand.openFactuur?.betaalLink ?? null
  const betaalBedrag = klaar?.bedragCent ?? stand.openFactuur?.bedragCent ?? null
  if (klaar || (stand.geactiveerd && stand.openFactuur)) {
    return (
      <div style={section}>
        <p style={label}>TEAM</p>
        <p style={body}>
          {klaar ? 'Je team is geactiveerd. ' : 'Er staat een factuur open voor je team. '}
          {betaalBedrag !== null ? `Bedrag: ${euro(betaalBedrag)} incl. btw. ` : ''}
          Je ontvangt de factuur per mail.
        </p>
        {betaalLink && <a href={betaalLink} style={btn}>BETAAL NU</a>}
      </div>
    )
  }

  if (!stand.kanActiveren) return null

  const verlopen = stand.proef?.staat === 'verlopen'
  return (
    <div style={section}>
      <p style={label}>TEAM</p>
      {stand.proef && (
        <p style={body}>
          {verlopen
            ? `Je gratis teamproef is afgelopen op ${datumNl(stand.proef.einde)}. Je team heeft geen toegang tot ArnoBot totdat je het activeert.`
            : `Je gratis teamproef loopt tot ${datumNl(stand.proef.einde)}. Dat is nog ${stand.proef.dagen} ${stand.proef.dagen === 1 ? 'dag' : 'dagen'}.`}
        </p>
      )}
      {!open ? (
        <button style={btn} onClick={() => setOpen(true)}>TEAM ACTIVEREN</button>
      ) : (
        <div>
          <label style={veldLabel} htmlFor="ta-seats">AANTAL GEBRUIKERS (MINIMAAL 3)</label>
          <input id="ta-seats" type="number" min={3} style={{ ...veld, maxWidth: 140 }} value={seats} onChange={e => setSeats(e.target.value)} />
          <span style={veldLabel}>BETALING</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={cyclus === 'maandelijks' ? btn : btnUit} onClick={() => setCyclus('maandelijks')}>MAANDELIJKS</button>
            <button style={cyclus === 'jaarlijks' ? btn : btnUit} onClick={() => setCyclus('jaarlijks')}>JAARLIJKS</button>
          </div>
          {tekstVeld('bedrijfsnaam', 'BEDRIJFSNAAM')}
          {tekstVeld('kvkNummer', 'KVK-NUMMER', '8 cijfers')}
          {tekstVeld('btwNummer', 'BTW-NUMMER', 'NL123456789B01')}
          {tekstVeld('straat', 'STRAAT EN HUISNUMMER')}
          {tekstVeld('postcode', 'POSTCODE', '1234 AB')}
          {tekstVeld('plaats', 'PLAATS')}

          <p style={{ ...body, marginTop: 24, marginBottom: 12 }}>
            {bedrag
              ? `Eerste factuur: ${euro(bedrag.nettoCent)} excl. btw (${euro(bedrag.brutoCent)} incl. btw), ${cyclus === 'jaarlijks' ? 'per jaar' : 'per maand'}.`
              : 'Kies minimaal 3 gebruikers om het bedrag te zien.'}
          </p>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: '#94a3b8', lineHeight: 1.5, cursor: 'pointer', marginBottom: 20, maxWidth: 520 }}>
            <input type="checkbox" checked={akkoord} onChange={e => setAkkoord(e.target.checked)} style={{ marginTop: 3, accentColor: '#f59e0b', width: 'auto', flex: 'none' }} />
            <span>Ik ga akkoord met de <a href="/voorwaarden" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>algemene voorwaarden</a> en heb de <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>privacyverklaring</a> gelezen.</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={{ ...btn, opacity: !akkoord || !bedrag || bezig ? 0.5 : 1 }} disabled={!akkoord || !bedrag || bezig} onClick={bevestig}>{bezig ? 'BEZIG...' : 'BEVESTIG'}</button>
            <button style={btnUit} disabled={bezig} onClick={() => { setOpen(false); setFout(null) }}>ANNULEER</button>
          </div>
          {fout && <p style={foutStijl}>{fout}</p>}
        </div>
      )}
    </div>
  )
}
