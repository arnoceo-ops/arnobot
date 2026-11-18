'use client'

import { useCallback, useEffect, useState } from 'react'
import { useIsNativeApp } from '@/hooks/useIsNativeApp'
import { BRON_NAAM, HISTORIE_VRAAG, IMPORT_BRONNEN, KOPJES, MAX_INVOER_TEKENS, bouwVraagLink, type ImportBron, type ImportProfiel } from '@/lib/historieImportVast'

// Het blok NEEM JE HISTORIE MEE onder de tab UPLOADS (docs/HISTORIE_IMPORT_PLAN.md). De gebruiker stuurt een vraag naar zijn andere
// AI, plakt het antwoord, controleert het voorstel en slaat het op als "Profiel uit ChatGPT". Alleen zichtbaar voor wie de schakelaar
// HISTORIE_IMPORT_OPEN heeft (de pagina bepaalt dat). Stijl volgt docs/app-styleguide.md en de rest van de tab.

type Opgeslagen = { bron: ImportBron; profiel: ImportProfiel; created_at: string }
type Stap = 'start' | 'bezig' | 'controle' | 'leeg'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const rustig: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 2, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'none' }
const pil: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 3, padding: '7px 20px', borderRadius: 999, background: 'none', cursor: 'pointer', border: '1px solid #374151', color: '#9ca3af', textDecoration: 'none', display: 'inline-block' }
const pilActief: React.CSSProperties = { ...pil, background: '#f59e0b', border: 'none', color: '#111827' }
// Kop en knop van deze sectie zijn gelijk aan die van de sectie erboven (DocsTab.tsx): dezelfde maten en dezelfde vaste breedte (minWidth 280 in allebei), zodat het twee gelijkwaardige blokken zijn.
const kopTekst: React.CSSProperties = { fontSize: 13, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase' }
const groteKnop: React.CSSProperties = { background: '#f59e0b', border: 'none', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#111827', padding: '12px 36px', minWidth: 280, borderRadius: 999 }

function datum(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })
}
const FOUTEN: Record<string, string> = {
  invoer_te_lang: 'Dat antwoord is te lang. Plak alleen het antwoord van je andere AI.',
  invoer_leeg: 'Plak eerst het antwoord van je andere AI.',
  rate_limit: 'Je hebt het te vaak geprobeerd. Probeer het over een uur opnieuw.',
  omzetten_mislukt: 'Het omzetten is niet gelukt. Probeer het opnieuw.',
}

export default function HistorieImportBlok({ isMobile }: { isMobile: boolean }) {
  // In de Android-app en op een telefoon (Arno, 2026-11-18) kan niets worden toegevoegd of vervangen: de link naar de andere AI opent buiten de app en het
  // klembord is daar onbetrouwbaar. Opgeslagen profielen blijven zichtbaar en te verwijderen.
  const isNativeApp = useIsNativeApp()
  // Alleen via de computer (Arno, 2026-11-18): ook een telefoonbrowser kan niets toevoegen of vervangen.
  const alleenBekijken = isNativeApp || isMobile
  const [opgeslagen, setOpgeslagen] = useState<Opgeslagen[] | undefined>(undefined) // undefined = nog aan het laden
  const [stap, setStap] = useState<Stap>('start')
  const [open, setOpen] = useState(false) // de vragen en het plakveld
  const [bron, setBron] = useState<ImportBron>('anders')
  const [tekst, setTekst] = useState('')
  const [voorstel, setVoorstel] = useState<ImportProfiel | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [gekopieerd, setGekopieerd] = useState(false)
  const [bevestig, setBevestig] = useState<ImportBron | null>(null) // het profiel dat de gebruiker wil verwijderen
  const [uitgeklapt, setUitgeklapt] = useState<ImportBron | null>(null) // het profiel waarvan de regels getoond worden
  const [bezig, setBezig] = useState(false)

  const laad = useCallback(async () => {
    try {
      const r = await fetch('/api/bot/import/profiel')
      if (!r.ok) throw new Error('laden mislukt')
      const d = await r.json()
      setOpgeslagen(Array.isArray(d.profielen) ? d.profielen : [])
    } catch {
      setOpgeslagen([])
    }
  }, [])

  useEffect(() => {
    let actueel = true
    fetch('/api/bot/import/profiel')
      .then(r => { if (!r.ok) throw new Error('laden mislukt'); return r.json() })
      .then(d => { if (actueel) setOpgeslagen(Array.isArray(d.profielen) ? d.profielen : []) })
      .catch(() => { if (actueel) setOpgeslagen([]) })
    return () => { actueel = false }
  }, [])

  // De vraag gaat altijd ook naar het klembord: de vooraf ingevulde vraag in de link werkt niet overal (en niet in de app).
  async function kopieerVraag(b: ImportBron) {
    setBron(b)
    try {
      await navigator.clipboard.writeText(HISTORIE_VRAAG)
      setGekopieerd(true)
    } catch {
      setGekopieerd(false)
    }
  }

  async function plakAntwoord() {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setTekst(t.slice(0, MAX_INVOER_TEKENS + 1))
    } catch {
      /* de browser staat het klembord lezen niet toe: de gebruiker plakt zelf in het veld */
    }
  }

  async function controleer() {
    setFout(null)
    setBezig(true)
    setStap('bezig')
    try {
      const r = await fetch('/api/bot/import/omzetten', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ tekst }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setFout(FOUTEN[d.error] ?? 'Er ging iets mis. Probeer het opnieuw.')
        setStap('start')
        return
      }
      setVoorstel(d.profiel as ImportProfiel)
      setStap(d.leeg ? 'leeg' : 'controle')
    } catch {
      setFout('Er ging iets mis. Probeer het opnieuw.')
      setStap('start')
    } finally {
      setBezig(false)
    }
  }

  async function slaOp() {
    if (!voorstel) return
    setFout(null)
    setBezig(true)
    try {
      const r = await fetch('/api/bot/import/profiel', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ bron, profiel: voorstel }) })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setFout(d.error === 'leeg' ? 'Er blijft niets over om op te slaan.' : 'Opslaan mislukt. Probeer het opnieuw.')
        return
      }
      reset()
      await laad()
    } catch {
      setFout('Opslaan mislukt. Probeer het opnieuw.')
    } finally {
      setBezig(false)
    }
  }

  async function verwijder(bronVerwijder: ImportBron) {
    setFout(null)
    setBezig(true)
    try {
      const r = await fetch(`/api/bot/import/profiel?bron=${bronVerwijder}`, { method: 'DELETE' })
      if (!r.ok) { setFout('Verwijderen mislukt. Probeer het opnieuw.'); return }
      setBevestig(null)
      setOpgeslagen(v => (v ?? []).filter(p => p.bron !== bronVerwijder))
    } catch {
      setFout('Verwijderen mislukt. Probeer het opnieuw.')
    } finally {
      setBezig(false)
    }
  }

  function reset() {
    setStap('start'); setOpen(false); setTekst(''); setVoorstel(null); setFout(null); setGekopieerd(false); setBron('anders')
  }

  function haalWeg(sleutel: keyof ImportProfiel, i: number) {
    setVoorstel(v => v ? { ...v, [sleutel]: v[sleutel].filter((_, n) => n !== i) } : v)
  }

  if (opgeslagen === undefined) return null
  if (alleenBekijken && opgeslagen.length === 0) return null
  const teLang = tekst.length > MAX_INVOER_TEKENS
  const nogRegels = voorstel ? KOPJES.some(k => voorstel[k.sleutel].length > 0) : false

  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <span style={kopTekst}>Neem je historie mee</span>
        {!alleenBekijken && opgeslagen.length > 0 && opgeslagen.length < IMPORT_BRONNEN.length && !open && (
          <button onClick={() => { setBron('anders'); setOpen(true) }} style={groteKnop}>+ ANDERE AI TOEVOEGEN</button>
        )}
      </div>

      {opgeslagen.length > 0 && stap === 'start' && !open && (
        <div>
          {opgeslagen.map(p => {
            const isOpen = uitgeklapt === p.bron
            const aantal = KOPJES.reduce((som, k) => som + p.profiel[k.sleutel].length, 0)
            return (
              <div key={p.bron} style={{ borderTop: '1px solid #374151' }}>
                <div
                  onClick={() => { setUitgeklapt(isOpen ? null : p.bron); setBevestig(null) }}
                  style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 8 : 24, padding: '20px 0', cursor: 'pointer' }}
                >
                  <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', width: isMobile ? 'auto' : 165, flexShrink: 0 }}>{datum(p.created_at)}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#f1f5f9', fontSize: isMobile ? 18 : 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4, marginBottom: 6 }}>Profiel uit {BRON_NAAM[p.bron]}</p>
                    <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.8 }}>{aantal} {aantal === 1 ? 'regel' : 'regels'}</p>
                  </div>
                  <span style={{ color: isOpen ? '#f59e0b' : '#9ca3af', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, flexShrink: 0 }}>{isOpen ? '↑ SLUITEN' : '↓ OPEN'}</span>
                </div>

                {isOpen && (
                  <div style={{ paddingBottom: 40, marginLeft: isMobile ? 0 : 189 }}>
                    {KOPJES.filter(k => p.profiel[k.sleutel].length > 0).map(k => (
                      <div key={k.sleutel} style={{ marginBottom: 16 }}>
                        <p style={{ color: '#6b7280', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>{k.label}</p>
                        {p.profiel[k.sleutel].map((r, i) => (
                          <p key={i} style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.8 }}>{r}</p>
                        ))}
                      </div>
                    ))}
                    {bevestig === p.bron ? (
                      <div style={{ fontSize: 15, color: '#f1f5f9', lineHeight: 1.9 }}>
                        <span>Dit profiel verwijderen? Dit kan niet ongedaan worden gemaakt.</span>
                        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                          <button onClick={() => setBevestig(null)} style={pil}>ANNULEER</button>
                          <button onClick={() => verwijder(p.bron)} disabled={bezig} style={{ ...pil, borderColor: '#cc2200', color: '#cc2200' }}>{bezig ? 'BEZIG...' : 'JA, VERWIJDER'}</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 8 }}>
                        {!alleenBekijken && <button onClick={() => { setBron(p.bron); setOpen(true) }} style={rustig}>vervang</button>}
                        <button onClick={() => setBevestig(p.bron)} style={{ ...rustig, color: '#cc2200' }}>verwijder</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {opgeslagen.length === 0 && !open && (
        <div>
          <p style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.9, maxWidth: 620 }}>
            Gebruik je al een andere AI? Haal eruit wat die van je weet, dan kent ArnoBot je vanaf het eerste gesprek.
          </p>
          <button onClick={() => setOpen(true)} style={{ ...groteKnop, marginTop: 20 }}>BEGIN</button>
        </div>
      )}

      {open && (stap === 'start' || stap === 'bezig') && (
        <div style={{ maxWidth: 620 }}>
          <p style={{ color: '#f1f5f9', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2 }}>1 Verstuur de vraag</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <a href={bouwVraagLink('chatgpt')} target="_blank" rel="noopener noreferrer" onClick={() => kopieerVraag('chatgpt')} style={pil}>OPEN IN CHATGPT</a>
            <a href={bouwVraagLink('claude')} target="_blank" rel="noopener noreferrer" onClick={() => kopieerVraag('claude')} style={pil}>OPEN IN CLAUDE</a>
            <a href={bouwVraagLink('gemini')} target="_blank" rel="noopener noreferrer" onClick={() => kopieerVraag('gemini')} style={pil}>OPEN IN GEMINI</a>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => kopieerVraag('anders')} style={rustig}>andere AI: kopieer de vraag</button>
          </div>
          {gekopieerd && <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>De vraag staat op je klembord. Staat hij er niet vanzelf in, plak hem dan zelf.</p>}

          <p style={{ color: '#f1f5f9', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, marginTop: 28 }}>2 Kopieer het antwoord</p>

          <p style={{ color: '#f1f5f9', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, marginTop: 28 }}>3 Plak het hier</p>
          <textarea
            value={tekst}
            onChange={e => setTekst(e.target.value)}
            onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#374151' }}
            rows={8}
            aria-label="Antwoord van je andere AI"
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, background: '#1f2937', border: '1.5px solid #374151', borderRadius: 4, color: '#f1f5f9', fontFamily: "'Space Mono', monospace", fontSize: 14, lineHeight: 1.7, padding: '12px 16px', outline: 'none', resize: 'vertical' }}
          />
          {teLang && <p style={{ color: '#cc2200', fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>{FOUTEN.invoer_te_lang}</p>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
            <button onClick={controleer} disabled={bezig || teLang || tekst.trim().length === 0} style={{ ...pilActief, opacity: bezig || teLang || tekst.trim().length === 0 ? 0.5 : 1 }}>{bezig ? 'BEZIG...' : 'CONTROLEER'}</button>
            <button onClick={plakAntwoord} disabled={bezig} style={pil}>PLAK ANTWOORD</button>
            <button onClick={reset} disabled={bezig} style={rustig}>annuleer</button>
          </div>
        </div>
      )}

      {open && stap === 'leeg' && (
        <div style={{ maxWidth: 620 }}>
          <p style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.9 }}>Je andere AI had niets van je opgeslagen.</p>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => { setStap('start'); setVoorstel(null) }} style={pil}>TERUG</button>
          </div>
        </div>
      )}

      {open && stap === 'controle' && voorstel && (
        <div style={{ maxWidth: 620 }}>
          <p style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.9 }}>Dit gaat naar ArnoBot. Haal weg wat niet klopt.</p>
          <div style={{ marginTop: 16 }}>
            {KOPJES.filter(k => voorstel[k.sleutel].length > 0).map(k => (
              <div key={k.sleutel} style={{ marginBottom: 20 }}>
                <p style={{ color: '#6b7280', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>{k.label}</p>
                {voorstel[k.sleutel].map((r, i) => (
                  <div key={`${k.sleutel}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '4px 0' }}>
                    <p style={{ flex: 1, color: '#f1f5f9', fontSize: 15, lineHeight: 1.8 }}>{r}</p>
                    <button onClick={() => haalWeg(k.sleutel, i)} aria-label="Haal deze regel weg" style={{ ...rustig, fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <button onClick={slaOp} disabled={bezig || !nogRegels} style={{ ...pilActief, opacity: bezig || !nogRegels ? 0.5 : 1 }}>{bezig ? 'BEZIG...' : 'OPSLAAN'}</button>
            <button onClick={reset} disabled={bezig} style={pil}>ANNULEER</button>
          </div>
        </div>
      )}

      {fout && <p style={{ color: '#cc2200', fontSize: 14, lineHeight: 1.8, marginTop: 16 }}>{fout}</p>}
    </div>
  )
}
