'use client'

import { useState } from 'react'

const label: React.CSSProperties = { display: 'block', fontSize: 12, letterSpacing: 1, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }
const input: React.CSSProperties = { fontSize: 14, padding: '6px 8px', borderRadius: 4, border: '1px solid #374151', background: '#111827', color: '#f1f5f9', width: '100%' }
const btn: React.CSSProperties = { fontSize: 12, letterSpacing: 1, fontWeight: 700, padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', background: '#f59e0b', color: '#111827' }

export interface TeamBillingInitial {
  teamId: string
  teamName: string
  minSeats: number | null
  cyclus: 'maandelijks' | 'jaarlijks' | null
  volgendeFactuurdatum: string | null
  geblokkeerdAt: string | null
  bedrijfsnaam: string | null
  kvkNummer: string | null
  btwNummer: string | null
  straat: string | null
  postcode: string | null
  plaats: string | null
}

interface SoloVoorbeeld {
  soloOmschrijving: string
  soloNettoCent: number
  ingaatOp: string
  seats: number
  cyclus: 'maandelijks' | 'jaarlijks'
  teamNettoCent: number
  alGeregeld: boolean
  hervat: boolean
}

const euro = (cent: number) => `€${(cent / 100).toFixed(2).replace('.', ',')}`
const datumNl = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })

export default function TeamBillingForm({ initial }: { initial: TeamBillingInitial }) {
  const [minSeats, setMinSeats] = useState(initial.minSeats?.toString() ?? '')
  const [cyclus, setCyclus] = useState(initial.cyclus ?? 'maandelijks')
  const [volgendeFactuurdatum, setVolgendeFactuurdatum] = useState(initial.volgendeFactuurdatum ?? '')
  const [bedrijfsnaam, setBedrijfsnaam] = useState(initial.bedrijfsnaam ?? '')
  const [kvkNummer, setKvkNummer] = useState(initial.kvkNummer ?? '')
  const [btwNummer, setBtwNummer] = useState(initial.btwNummer ?? '')
  const [straat, setStraat] = useState(initial.straat ?? '')
  const [postcode, setPostcode] = useState(initial.postcode ?? '')
  const [plaats, setPlaats] = useState(initial.plaats ?? '')
  const [status, setStatus] = useState<'idle' | 'bezig' | 'opgeslagen' | 'fout'>('idle')
  const [foutTekst, setFoutTekst] = useState('')
  const [geblokkeerd, setGeblokkeerd] = useState(!!initial.geblokkeerdAt)
  const [solo, setSolo] = useState<
    { stap: 'uit' } | { stap: 'bezig' } | { stap: 'voorbeeld'; voorbeeld: SoloVoorbeeld } | { stap: 'klaar'; voorbeeld: SoloVoorbeeld } | { stap: 'fout'; fout: string }
  >({ stap: 'uit' })

  async function opslaan() {
    setStatus('bezig')
    const res = await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: initial.teamId,
        minSeats: minSeats ? Number(minSeats) : null,
        cyclus,
        volgendeFactuurdatum: volgendeFactuurdatum || null,
        bedrijfsnaam, kvkNummer, btwNummer, straat, postcode, plaats,
      }),
    })
    // De server valideert alles vóór het opslaat: bij een fout is er dus niets opgeslagen.
    // De reden (bijvoorbeeld een lege bedrijfsnaam) staat naast "Mislukt".
    if (!res.ok) setFoutTekst(String((await res.json().catch(() => ({}))).error ?? ''))
    else setFoutTekst('')
    setStatus(res.ok ? 'opgeslagen' : 'fout')
  }

  // Solo naar Team: eerst een voorbeeld (de server controleert alles opnieuw), dan pas uitvoeren.
  async function soloVoorbeeld() {
    setSolo({ stap: 'bezig' })
    const res = await fetch('/api/admin/teams/solo-naar-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: initial.teamId, minSeats: Number(minSeats), cyclus, actie: 'voorbeeld' }),
    })
    const data = await res.json().catch(() => ({}))
    setSolo(res.ok ? { stap: 'voorbeeld', voorbeeld: data as SoloVoorbeeld } : { stap: 'fout', fout: String(data.error ?? 'Mislukt') })
  }

  async function soloUitvoeren() {
    setSolo({ stap: 'bezig' })
    const res = await fetch('/api/admin/teams/solo-naar-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: initial.teamId, minSeats: Number(minSeats), cyclus, actie: 'uitvoeren' }),
    })
    const data = await res.json().catch(() => ({}))
    setSolo(res.ok ? { stap: 'klaar', voorbeeld: data as SoloVoorbeeld } : { stap: 'fout', fout: String(data.error ?? 'Mislukt') })
  }

  async function deblokkeer() {
    setStatus('bezig')
    const res = await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: initial.teamId, geblokkeerdAt: null }),
    })
    if (res.ok) setGeblokkeerd(false)
    setStatus(res.ok ? 'opgeslagen' : 'fout')
  }

  return (
    <div style={{ border: '1px solid #1f2937', borderRadius: 8, padding: 16, marginBottom: 16, background: '#0f172a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{initial.teamName}</span>
        {geblokkeerd && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, letterSpacing: 1, color: '#ef4444', fontWeight: 700 }}>GEBLOKKEERD</span>
            <button onClick={deblokkeer} style={{ ...btn, background: '#374151', color: '#f1f5f9' }}>DEBLOKKEER</button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label}>Min. seats</label>
          <input style={input} type="number" min={1} value={minSeats} onChange={e => setMinSeats(e.target.value)} placeholder="niet geactiveerd" />
        </div>
        <div>
          <label style={label}>Cyclus</label>
          <select style={input} value={cyclus} onChange={e => setCyclus(e.target.value as 'maandelijks' | 'jaarlijks')}>
            <option value="maandelijks">Maandelijks</option>
            <option value="jaarlijks">Jaarlijks</option>
          </select>
        </div>
        <div>
          <label style={label}>Volgende factuurdatum</label>
          <input style={input} type="date" value={volgendeFactuurdatum} onChange={e => setVolgendeFactuurdatum(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label}>Bedrijfsnaam</label>
          <input style={input} value={bedrijfsnaam} onChange={e => setBedrijfsnaam(e.target.value)} />
        </div>
        <div>
          <label style={label}>KvK-nummer</label>
          <input style={input} value={kvkNummer} onChange={e => setKvkNummer(e.target.value)} />
        </div>
        <div>
          <label style={label}>BTW-nummer</label>
          <input style={input} value={btwNummer} onChange={e => setBtwNummer(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label}>Straat</label>
          <input style={input} value={straat} onChange={e => setStraat(e.target.value)} />
        </div>
        <div>
          <label style={label}>Postcode</label>
          <input style={input} value={postcode} onChange={e => setPostcode(e.target.value)} />
        </div>
        <div>
          <label style={label}>Plaats</label>
          <input style={input} value={plaats} onChange={e => setPlaats(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={opslaan} disabled={status === 'bezig'} style={btn}>{status === 'bezig' ? 'BEZIG...' : 'OPSLAAN'}</button>
        {status === 'opgeslagen' && <span style={{ fontSize: 12, color: '#22c55e' }}>Opgeslagen</span>}
        {status === 'fout' && <span style={{ fontSize: 12, color: '#ef4444' }}>Mislukt{foutTekst ? `: ${foutTekst}` : ''}</span>}
      </div>

      {/* Zakelijke solo-klant met een maandabonnement die Team wordt (docs/OVERSTAP_PLAN.md). Gebruikt de seats en
          cyclus hierboven; de volgende factuurdatum volgt uit het einde van het solo-abonnement. */}
      <div style={{ borderTop: '1px solid #1f2937', marginTop: 16, paddingTop: 12 }}>
        {solo.stap === 'uit' || solo.stap === 'fout' ? (
          <>
            <button onClick={soloVoorbeeld} disabled={!minSeats} style={{ ...btn, background: '#374151', color: '#f1f5f9', opacity: minSeats ? 1 : 0.5 }}>
              SOLO NAAR TEAM
            </button>
            <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 12 }}>Vul eerst min. seats en cyclus in. Toont eerst een voorbeeld.</span>
            {solo.stap === 'fout' && <p style={{ fontSize: 13, color: '#ef4444', marginTop: 8 }}>{solo.fout}</p>}
          </>
        ) : solo.stap === 'bezig' ? (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>Bezig...</span>
        ) : solo.stap === 'klaar' ? (
          <p style={{ fontSize: 13, color: '#22c55e' }}>
            {solo.voorbeeld.alGeregeld ? 'Was al geregeld.' : 'Geregeld.'} Het solo-abonnement loopt door tot {datumNl(solo.voorbeeld.ingaatOp)}, daarna start de eerste Team-factuur.
          </p>
        ) : (
          <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>
            <p style={{ fontSize: 12, letterSpacing: 1, color: '#f59e0b', fontWeight: 700, marginBottom: 6 }}>VOORBEELD</p>
            <p>Solo: {solo.voorbeeld.soloOmschrijving}, {euro(solo.voorbeeld.soloNettoCent)} excl. BTW</p>
            <ol style={{ paddingLeft: 20, margin: '6px 0 10px' }}>
              {solo.voorbeeld.alGeregeld ? (
                <li>Dit is al geregeld. Uitvoeren verandert niets.</li>
              ) : (
                <>
                  <li>{solo.voorbeeld.hervat ? 'De Mollie-incasso is al gestopt; de rest wordt afgemaakt.' : 'De Mollie-incasso stopt nu.'}</li>
                  <li>Het solo-abonnement loopt door tot {datumNl(solo.voorbeeld.ingaatOp)}.</li>
                  <li>Team-factuur 1 op {datumNl(solo.voorbeeld.ingaatOp)}: {euro(solo.voorbeeld.teamNettoCent)} excl. BTW ({solo.voorbeeld.seats} seats, {solo.voorbeeld.cyclus}).</li>
                  <li>De teambaas krijgt een mail.</li>
                </>
              )}
            </ol>
            <button onClick={soloUitvoeren} style={btn}>BEVESTIG</button>
            <button onClick={() => setSolo({ stap: 'uit' })} style={{ ...btn, background: '#374151', color: '#f1f5f9', marginLeft: 8 }}>ANNULEER</button>
          </div>
        )}
      </div>
    </div>
  )
}
