'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { kortTitel } from '@/lib/kortTitel'

// De tab UPLOADS op de ARCHIEF-pagina (docs/DOCUMENTEN_PLAN.md): de bewaarde bestanden van de gebruiker. Alleen zichtbaar
// voor wie de documentenfunctie heeft (de pagina bepaalt dat). Stijl en indeling volgen de gespreksrijen op dezelfde pagina
// en docs/app-styleguide.md.

type DocGesprek = { sessie: string; datum: string; titel: string | null }
type Doc = {
  id: string
  naam: string
  soort: 'document' | 'transcript'
  media_type: string
  bytes: number
  session_id: string | null
  created_at: string
  laatst_gebruikt: string
  gesprekken: DocGesprek[]
}

const TOEGESTAAN = [
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_BYTES = 20 * 1024 * 1024
const MAX_AFBEELDING_BYTES = 10 * 1024 * 1024 // een afbeelding mag bij Anthropic niet groter zijn
const JSON_HEADERS = { 'Content-Type': 'application/json' }
// Bij veel gesprekken over één bestand blijft de open rij rustig: de nieuwste drie, de rest achter een knop.
const MAX_GESPREKKEN = 3

function typeLabel(d: Doc): string {
  if (d.soort === 'transcript') return 'TRANSCRIPT'
  if (d.media_type === 'application/pdf') return 'PDF'
  if (d.media_type.startsWith('image/')) return 'AFBEELDING'
  if (d.media_type.includes('wordprocessingml')) return 'WORD'
  if (d.media_type === 'text/csv') return 'CSV'
  return 'TEKST'
}
function grootte(bytes: number): string {
  if (bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
function datum(iso: string, kort = false): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: kort ? 'short' : 'long', year: kort ? undefined : 'numeric', timeZone: 'Europe/Amsterdam' })
}
function zonderExtensie(naam: string): string {
  return naam.replace(/\.[A-Za-z0-9]{1,7}$/, '')
}
function gebruiktTekst(n: number): string {
  if (n === 0) return 'nog in geen gesprek gebruikt'
  return n === 1 ? 'in 1 gesprek gebruikt' : `in ${n} gesprekken gebruikt`
}

const knop: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'none' }
// Secundaire links naar docs/app-styleguide.md: Space Mono 13, gedempt, geen onderstreping. Letterspatiëring 2 in plaats van 4 (Arno, 2026-11-18): in kleine letters leest dat beter.
const rustig: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 2, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'none' }
const pil: React.CSSProperties = { fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 3, padding: '7px 20px', borderRadius: 999, background: 'none', cursor: 'pointer', border: '1px solid #374151', color: '#9ca3af' }

export default function DocsTab({ isMobile, onAantal }: { isMobile: boolean; onAantal: (n: number) => void }) {
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [gebruik, setGebruik] = useState({ aantal: 0, bytes: 0 })
  const [grenzen, setGrenzen] = useState<{ maxDocumenten: number; maxBytes: number } | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [hernoem, setHernoem] = useState<{ id: string; waarde: string } | null>(null)
  const [bevestig, setBevestig] = useState<string | null>(null) // een document-ID
  const [alleGesprekken, setAlleGesprekken] = useState<string | null>(null) // het document waarvan alle gesprekken getoond worden
  const [bezig, setBezig] = useState(false)
  const [uploaden, setUploaden] = useState(false)
  const bestandRef = useRef<HTMLInputElement>(null)

  // Zet het antwoord van de server in de state; wordt vanuit een antwoord-callback aangeroepen, nooit direct in een effect.
  const pas = useCallback((d: { documenten?: Doc[]; gebruik?: { aantal: number; bytes: number }; grenzen?: { maxDocumenten: number; maxBytes: number } }) => {
    const lijst: Doc[] = Array.isArray(d.documenten) ? d.documenten : []
    setDocs(lijst)
    setGebruik(d.gebruik ?? { aantal: lijst.length, bytes: 0 })
    setGrenzen(d.grenzen ?? null)
    onAantal(lijst.length)
  }, [onAantal])

  const laad = useCallback(async () => {
    try {
      const r = await fetch('/api/bot/documenten')
      if (!r.ok) throw new Error('laden mislukt')
      pas(await r.json())
    } catch {
      setDocs([])
      setFout('Laden mislukt. Ververs de pagina en probeer opnieuw.')
    }
  }, [pas])

  useEffect(() => {
    let actueel = true
    fetch('/api/bot/documenten')
      .then(r => { if (!r.ok) throw new Error('laden mislukt'); return r.json() })
      .then(d => { if (actueel) pas(d) })
      .catch(() => { if (actueel) { setDocs([]); setFout('Laden mislukt. Ververs de pagina en probeer opnieuw.') } })
    return () => { actueel = false }
  }, [pas])

  async function voegToe(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFout(null)
    if (!TOEGESTAAN.includes(file.type)) { setFout('Alleen PDF, Word of een afbeelding wordt ondersteund.'); return }
    const maxBytes = file.type.startsWith('image/') ? MAX_AFBEELDING_BYTES : MAX_BYTES
    if (file.size > maxBytes) { setFout(`Bestand is groter dan ${maxBytes / (1024 * 1024)}MB.`); return }
    setUploaden(true)
    try {
      const urlRes = await fetch('/api/bot/chat-upload-url', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ mediaType: file.type }) })
      const urlData = await urlRes.json().catch(() => ({}))
      if (!urlRes.ok) { setFout('Bestand kon niet worden geüpload.'); return }
      const put = await fetch(urlData.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!put.ok) { setFout('Bestand kon niet worden geüpload.'); return }
      const res = await fetch('/api/bot/documenten', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ storagePath: urlData.path, name: file.name, mediaType: file.type }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFout(data.error === 'docs_vol' ? 'Je Uploads zitten vol. Verwijder eerst een bestand.'
          : data.error === 'bestand_niet_leesbaar' ? 'Dat bestand kon niet worden gelezen. Probeer een ander bestand.'
          : 'Bestand kon niet worden toegevoegd.')
        return
      }
      await laad()
    } catch {
      setFout('Bestand kon niet worden geüpload.')
    } finally {
      setUploaden(false)
    }
  }

  async function slaNaamOp() {
    if (!hernoem) return
    setBezig(true)
    setFout(null)
    try {
      const r = await fetch('/api/bot/documenten/' + hernoem.id, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ naam: hernoem.waarde }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && typeof d.naam === 'string') {
        const id = hernoem.id
        setDocs(prev => (prev ? prev.map(x => (x.id === id ? { ...x, naam: d.naam } : x)) : prev))
        setHernoem(null)
      } else {
        setFout(d.error === 'naam_leeg' ? 'Geef het bestand een naam.' : 'Hernoemen mislukt. Probeer het opnieuw.')
      }
    } catch {
      setFout('Hernoemen mislukt. Probeer het opnieuw.')
    } finally {
      setBezig(false)
    }
  }

  async function verwijder(id: string) {
    setBezig(true)
    setFout(null)
    try {
      const r = await fetch('/api/bot/documenten/' + id, { method: 'DELETE' })
      if (!r.ok) throw new Error('verwijderen mislukt')
      setBevestig(null)
      setOpen(null)
      await laad()
    } catch {
      setFout('Verwijderen mislukt. Probeer het opnieuw.')
    } finally {
      setBezig(false)
    }
  }

  const aantal = docs?.length ?? 0

  return (
    <div style={{ fontFamily: "'Space Mono', monospace" }}>
      <input ref={bestandRef} type="file" onChange={voegToe} accept=".pdf,.docx,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <span style={{ fontSize: 13, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase' }}>
          {docs === null ? 'Laden...' : `${gebruik.aantal} ${gebruik.aantal === 1 ? 'upload' : 'uploads'} · ${grootte(gebruik.bytes)}${grenzen ? ` van ${Math.round(grenzen.maxBytes / (1024 * 1024))} MB` : ''}`}
        </span>
        <button
          onClick={() => bestandRef.current?.click()}
          disabled={uploaden}
          style={{ background: uploaden ? '#374151' : '#f59e0b', border: 'none', cursor: uploaden ? 'not-allowed' : 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 3, color: uploaden ? '#6b7280' : '#111827', padding: '12px 36px', borderRadius: 999 }}
        >
          {uploaden ? 'BEZIG...' : '+ BESTAND TOEVOEGEN'}
        </button>
      </div>

      {fout && (
        <p style={{ fontSize: 13, color: '#cc4444', lineHeight: 1.8, border: '1px solid #cc4444', borderLeft: '3px solid #cc4444', padding: '10px 16px', marginBottom: 24 }}>{fout}</p>
      )}

      {docs !== null && aantal === 0 && !fout && (
        <div style={{ borderTop: '1px solid #374151', padding: '48px 0', textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>Nog geen uploads</p>
          <p style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.9 }}>Voeg er een toe, of laat het vinkje BEWAAR IN UPLOADS aan staan als je in een gesprek een bestand toevoegt.</p>
        </div>
      )}

      {(docs ?? []).map(d => {
        const isOpen = open === d.id
        const hernoemt = hernoem?.id === d.id
        const sub = `${typeLabel(d)} · ${grootte(d.bytes)} · ${gebruiktTekst(d.gesprekken.length)}`
        return (
          <div key={d.id} style={{ borderTop: '1px solid #374151' }}>
            <div
              onClick={() => { setOpen(isOpen ? null : d.id); setBevestig(null); setHernoem(null) }}
              style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 8 : 24, padding: isMobile ? '24px 0' : '32px 0', cursor: 'pointer' }}
            >
              <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', width: isMobile ? 'auto' : 165, flexShrink: 0 }}>{datum(d.created_at, isMobile)}</span>
              <div style={{ flex: 1 }}>
                {hernoemt ? (
                  <input
                    value={hernoem.waarde}
                    onChange={e => setHernoem({ id: d.id, waarde: e.target.value })}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => { if (e.key === 'Enter') slaNaamOp(); if (e.key === 'Escape') setHernoem(null) }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#374151' }}
                    maxLength={120}
                    autoFocus
                    aria-label="Nieuwe naam"
                    style={{ width: '100%', background: '#1f2937', border: '1.5px solid #f59e0b', borderRadius: 4, color: '#f1f5f9', fontFamily: "'Space Mono', monospace", fontSize: 15, padding: '12px 16px', outline: 'none' }}
                  />
                ) : (
                  <p style={{ color: '#f1f5f9', fontSize: isMobile ? 18 : 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, lineHeight: 1.4, wordBreak: 'break-word' }}>{d.naam}</p>
                )}
                <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.8 }}>{sub}</p>
              </div>
              <span style={{ color: isOpen ? '#f59e0b' : '#9ca3af', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, flexShrink: 0 }}>{isOpen ? '↑ SLUITEN' : '↓ OPEN'}</span>
            </div>

            {isOpen && (
              <div style={{ paddingBottom: 40, marginLeft: isMobile ? 0 : 189 }}>
                {hernoemt ? (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={slaNaamOp} disabled={bezig} style={{ ...pil, background: '#f59e0b', border: 'none', color: '#111827' }}>{bezig ? 'BEZIG...' : 'OPSLAAN'}</button>
                    <button onClick={() => setHernoem(null)} style={pil}>ANNULEER</button>
                  </div>
                ) : bevestig === d.id ? (
                  <div style={{ fontSize: 15, color: '#f1f5f9', lineHeight: 1.9 }}>
                    <span>Dit bestand verwijderen? Dit kan niet ongedaan worden gemaakt.</span>
                    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                      <button onClick={() => setBevestig(null)} style={pil}>ANNULEER</button>
                      <button onClick={() => verwijder(d.id)} disabled={bezig} style={{ ...pil, borderColor: '#cc2200', color: '#cc2200' }}>{bezig ? 'BEZIG...' : 'JA, VERWIJDER'}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
                      <Link href={`/bot?doc=${d.id}`} style={knop}>NIEUW GESPREK MET DIT BESTAND <span style={{ color: '#f59e0b' }}>→</span></Link>
                      {d.gesprekken.length === 1 && (
                        <Link href={`/bot?resume=${d.gesprekken[0].sessie}`} style={knop}>VERVOLG HET GESPREK <span style={{ color: '#f59e0b' }}>→</span></Link>
                      )}
                    </div>

                    {d.gesprekken.length > 1 && (
                      <div style={{ marginTop: 20 }}>
                        {(alleGesprekken === d.id ? d.gesprekken : d.gesprekken.slice(0, MAX_GESPREKKEN)).map(g => (
                          <div key={g.sessie} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 24, padding: '10px 0' }}>
                            <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', width: isMobile ? 56 : 70, flexShrink: 0 }}>{datum(g.datum, true)}</span>
                            <span style={{ flex: 1, color: '#f1f5f9', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, lineHeight: 1.4, wordBreak: 'break-word' }}>
                              {g.titel ? kortTitel(g.titel) : `Gesprek van ${datum(g.datum, true)}`}
                            </span>
                            <Link href={`/bot?resume=${g.sessie}`} style={{ ...knop, whiteSpace: 'nowrap' }}>VERVOLG <span style={{ color: '#f59e0b' }}>→</span></Link>
                          </div>
                        ))}
                        {d.gesprekken.length > MAX_GESPREKKEN && (
                          <button onClick={() => setAlleGesprekken(alleGesprekken === d.id ? null : d.id)} style={{ ...knop, fontSize: 16, marginTop: 8 }}>
                            {alleGesprekken === d.id ? 'TOON MINDER ↑' : `TOON ALLE ${d.gesprekken.length} GESPREKKEN ↓`}
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 28 }}>
                      <button onClick={() => setHernoem({ id: d.id, waarde: zonderExtensie(d.naam) })} style={rustig}>hernoem</button>
                      <a href={`/api/bot/documenten/${d.id}/download`} download style={rustig}>download</a>
                      <button onClick={() => setBevestig(d.id)} style={{ ...rustig, color: '#cc2200' }}>verwijder</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
