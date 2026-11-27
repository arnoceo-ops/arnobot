'use client'

import { useCallback, useEffect, useState } from 'react'
import { useIsNativeApp } from '@/hooks/useIsNativeApp'
import type { ActivatieStand } from '@/lib/teamActivatie'
import { TEAM_MIN_TEAMLEDEN, TEAM_MAX_TEAMLEDEN, TEAM_GROOT_TEKST } from '@/lib/teamPricing'
import TeamKleinTekst from '../../components/TeamKleinTekst'

// Teamproef omzetten naar een betaald Team, bovenaan de accountpagina van de manager (docs/TEAM_PROCES.md,
// "Zelf activeren"). De server bepaalt wat er kan en wat het kost (GET /api/bot/team/activeren); deze
// component toont alleen. In de Android-app verborgen, net als andere koopverwijzingen (Google Play-beleid).
// Opmaak volgt de kaders op de accountpagina ("Jouw data is van jou"): donkere kaart, oranje rand links.

type Bedrag = { nettoCent: number; btwCent: number; brutoCent: number }
type Antwoord = { stand: ActivatieStand | null; bedrag: Bedrag | null; gefactureerdeTeamleden?: number | null; betalenBeschikbaar: boolean }

const VELDEN = ['bedrijfsnaam', 'kvkNummer', 'btwNummer', 'straat', 'postcode', 'plaats'] as const
type VeldNaam = typeof VELDEN[number]

const mono = "'Space Mono', monospace"
const bebas = "'Bebas Neue', sans-serif"

const kaart = (kleur: string): React.CSSProperties => ({ background: '#1f2937', borderLeft: `4px solid ${kleur}`, padding: '24px 28px', marginBottom: 48 })
const label: React.CSSProperties = { fontFamily: mono, fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 12 }
const kop: React.CSSProperties = { fontFamily: bebas, fontSize: 44, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', margin: '0 0 14px 0' }
const tekst: React.CSSProperties = { fontWeight: 400, color: '#9ca3af', fontSize: 15, lineHeight: '1.9', margin: '0 0 24px 0' }
const knop: React.CSSProperties = { padding: '12px 36px', border: 'none', background: '#f59e0b', color: '#111827', fontFamily: bebas, fontSize: 18, letterSpacing: 3, cursor: 'pointer', transition: 'background 0.2s', borderRadius: 999, display: 'inline-block', minWidth: 260, textAlign: 'center', textDecoration: 'none' }
const knopUit: React.CSSProperties = { ...knop, background: 'transparent', color: '#9ca3af', border: '1px solid #374151' }
const keuze = (aan: boolean): React.CSSProperties => ({ ...(aan ? knop : knopUit), minWidth: 0, padding: '9px 22px', fontSize: 16 })
const veldLabel: React.CSSProperties = { display: 'block', fontFamily: mono, fontSize: 11, letterSpacing: 3, color: '#6b7280', margin: '0 0 8px 0' }
const veld: React.CSSProperties = { width: '100%', padding: '12px 14px', background: '#111827', border: '1px solid #374151', color: '#f1f5f9', fontSize: 15, fontFamily: mono, borderRadius: 0, boxSizing: 'border-box' }
const raster: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 20 }

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
  // Wat de manager zelf typt; zolang er niets is getypt gelden het aantal teamleden zonder de manager (minimaal 3) en de bekende bedrijfsgegevens.
  const [seatsIngevuld, setSeats] = useState<string | null>(null)
  const [cyclus, setCyclus] = useState<'maandelijks' | 'jaarlijks'>('maandelijks')
  const [bewerkt, setBewerkt] = useState<Partial<Record<VeldNaam, string>>>({})
  const [akkoord, setAkkoord] = useState(false)
  const [bedrag, setBedrag] = useState<Bedrag | null>(null)
  const [gefactureerd, setGefactureerd] = useState<number | null>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [klaar, setKlaar] = useState<{ bedragCent: number; betaalLink: string | null } | null>(null)

  const seats = seatsIngevuld ?? String(Math.min(TEAM_MAX_TEAMLEDEN, Math.max(TEAM_MIN_TEAMLEDEN, stand?.ledenAantal ?? TEAM_MIN_TEAMLEDEN)))
  const f = Object.fromEntries(VELDEN.map(n => [n, bewerkt[n] ?? stand?.voorinvulling?.[n] ?? ''])) as Record<VeldNaam, string>

  // Het bedrag komt van de server (dezelfde berekening als de factuur), pas als de keuze geldig is.
  useEffect(() => {
    if (!open || !stand?.kanActiveren) return
    let geannuleerd = false
    fetch(`/api/bot/team/activeren?seats=${encodeURIComponent(seats)}&cyclus=${cyclus}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: Antwoord | null) => { if (!geannuleerd) { setBedrag(d?.bedrag ?? null); setGefactureerd(d?.gefactureerdeTeamleden ?? null) } })
      .catch(() => { if (!geannuleerd) { setBedrag(null); setGefactureerd(null) } })
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
    <div>
      <label style={veldLabel} htmlFor={`ta-${naam}`}>{titel}</label>
      <input id={`ta-${naam}`} className="ta-veld" style={veld} value={f[naam]} placeholder={plaatshouder} onChange={e => setBewerkt(h => ({ ...h, [naam]: e.target.value }))} />
    </div>
  )

  // Na het activeren, of voor een geactiveerd team met een openstaande factuur: alleen de betaalknop.
  const betaalLink = klaar?.betaalLink ?? stand.openFactuur?.betaalLink ?? null
  const betaalBedrag = klaar?.bedragCent ?? stand.openFactuur?.bedragCent ?? null
  if (klaar || (stand.geactiveerd && stand.openFactuur)) {
    return (
      <div style={kaart('#f59e0b')}>
        <p style={label}>TEAM</p>
        <h2 style={kop}>{klaar ? 'TEAM GEACTIVEERD' : 'FACTUUR OPEN'}</h2>
        <p style={tekst}>
          {betaalBedrag !== null ? `Bedrag: ${euro(betaalBedrag)} incl. btw. ` : ''}
          Je ontvangt de factuur per mail.
        </p>
        {betaalLink && <a href={betaalLink} style={knop}>BETAAL NU</a>}
      </div>
    )
  }

  if (!stand.kanActiveren) return null

  const verlopen = stand.proef?.staat === 'verlopen'
  const coulance = stand.proef?.staat === 'coulance'
  return (
    <div style={kaart(verlopen ? '#cc2200' : '#f59e0b')}>
      <style>{`.ta-veld:focus { outline: none; border-color: #f59e0b !important; } .ta-veld::placeholder { color: #4b5563; }`}</style>
      <p style={label}>{coulance ? 'TEAMPROEF AFGELOPEN' : 'TEAMPROEF'}</p>
      {stand.proef && (
        <>
          <h2 style={kop}>
            {verlopen ? 'PROEF AFGELOPEN' : `NOG ${stand.proef.dagen} ${stand.proef.dagen === 1 ? 'DAG' : 'DAGEN'}`}
          </h2>
          <p style={tekst}>
            {verlopen
              ? `Je gratis teamproef is afgelopen op ${datumNl(stand.proef.einde)}. Je team heeft geen toegang tot ArnoBot totdat je het activeert.`
              : coulance
                ? `Je team heeft nog toegang tot ${datumNl(stand.proef.toegangTot)}. Activeer je team vóór die datum, dan loopt alles door zonder onderbreking.`
                : `Je gratis teamproef loopt tot ${datumNl(stand.proef.einde)}.`}
          </p>
        </>
      )}
      {!open ? (
        <button style={knop} onClick={() => setOpen(true)}>TEAM ACTIVEREN</button>
      ) : (
        <div>
          <div style={raster}>
            <div>
              <label style={veldLabel} htmlFor="ta-seats">TEAMLEDEN, ZONDER JEZELF</label>
              <input id="ta-seats" className="ta-veld" type="number" min={TEAM_MIN_TEAMLEDEN} max={TEAM_MAX_TEAMLEDEN} style={{ ...veld, maxWidth: 160 }} value={seats} onChange={e => setSeats(e.target.value)} />
            </div>
            <div>
              <span style={veldLabel}>BETALING</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={keuze(cyclus === 'maandelijks')} onClick={() => setCyclus('maandelijks')}>MAANDELIJKS</button>
                <button style={keuze(cyclus === 'jaarlijks')} onClick={() => setCyclus('jaarlijks')}>JAARLIJKS</button>
              </div>
            </div>
          </div>

          <div style={raster}>{tekstVeld('bedrijfsnaam', 'BEDRIJFSNAAM')}</div>
          <div style={raster}>
            {tekstVeld('kvkNummer', 'KVK-NUMMER', '8 cijfers')}
            {tekstVeld('btwNummer', 'BTW-NUMMER', 'NL123456789B01')}
          </div>
          <div style={raster}>{tekstVeld('straat', 'STRAAT EN HUISNUMMER')}</div>
          <div style={raster}>
            {tekstVeld('postcode', 'POSTCODE', '1234 AB')}
            {tekstVeld('plaats', 'PLAATS')}
          </div>

          <div style={{ borderTop: '1px solid #374151', paddingTop: 20, marginBottom: 20 }}>
            <span style={veldLabel}>EERSTE FACTUUR</span>
            {bedrag ? (
              <>
                <p style={{ fontFamily: bebas, fontSize: 36, letterSpacing: 2, lineHeight: 1, color: '#f1f5f9', margin: '0 0 6px 0' }}>
                  {euro(bedrag.nettoCent)} <span style={{ fontSize: 18, color: '#9ca3af', letterSpacing: 2 }}>EXCL. BTW</span>
                </p>
                <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>
                  {euro(bedrag.brutoCent)} incl. btw, {cyclus === 'jaarlijks' ? 'per jaar' : 'per maand'}.
                  {gefactureerd !== null ? ` Voor jou als manager en ${gefactureerd} teamleden.` : ''}
                  {gefactureerd !== null && gefactureerd > Number(seats) ? ` Je team heeft al ${gefactureerd} teamleden, die tellen allemaal mee.` : ''}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
                {Number(seats) < TEAM_MIN_TEAMLEDEN ? <TeamKleinTekst />
                  : Number(seats) > TEAM_MAX_TEAMLEDEN ? <TeamKleinTekst tekst={TEAM_GROOT_TEKST} />
                    : !Number.isInteger(Number(seats)) ? 'Vul een heel getal in.'
                      : 'Het bedrag verschijnt hier zodra het is berekend.'}
              </p>
            )}
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: '#94a3b8', lineHeight: 1.5, cursor: 'pointer', marginBottom: 24, maxWidth: 560 }}>
            <input type="checkbox" checked={akkoord} onChange={e => setAkkoord(e.target.checked)} style={{ marginTop: 3, accentColor: '#f59e0b', width: 'auto', flex: 'none' }} />
            <span>Ik ga akkoord met de <a href="/voorwaarden" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>algemene voorwaarden</a> en heb de <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>privacyverklaring</a> gelezen.</span>
          </label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button style={{ ...knop, opacity: !akkoord || !bedrag || bezig ? 0.5 : 1, cursor: !akkoord || !bedrag || bezig ? 'not-allowed' : 'pointer' }} disabled={!akkoord || !bedrag || bezig} onClick={bevestig}>{bezig ? 'BEZIG...' : 'BEVESTIG'}</button>
            <button style={knopUit} disabled={bezig} onClick={() => { setOpen(false); setFout(null) }}>ANNULEER</button>
          </div>
          {fout && <p style={{ color: '#cc2200', fontSize: 14, lineHeight: 1.6, margin: '16px 0 0 0' }}>{fout}</p>}
        </div>
      )}
    </div>
  )
}
