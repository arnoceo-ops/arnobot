'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const veld: React.CSSProperties = { background: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#f1f5f9', fontSize: 16, padding: '6px 10px', fontFamily: 'inherit' }
const knop: React.CSSProperties = { background: '#f59e0b', color: '#000', border: 'none', borderRadius: 4, padding: '8px 14px', fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: 'pointer' }
const knopStil: React.CSSProperties = { ...knop, background: 'transparent', color: '#9ca3af', border: '1px solid #374151' }

type Besluit = 'toekennen' | 'afwijzen' | 'vervallen' | 'behouden'

const VRAAG: Record<Exclude<Besluit, 'toekennen'>, string> = {
  afwijzen: 'Afwijzen. Dit is definitief.',
  vervallen: 'Tegoed laten vervallen. Dit is definitief.',
  behouden: 'Tegoed behouden. Alleen wat hierna gebeurt telt nog.',
}

/**
 * Arno's besluit: toekennen of afwijzen van een referral die als handwerk is aangemerkt, of (met `verval`) een tegoed
 * dat lijkt te vervallen behouden of laten vervallen.
 */
export default function BesluitFormulier({ referralId, verval = false }: { referralId: string; verval?: boolean }) {
  const router = useRouter()
  const [bedrag, setBedrag] = useState('')
  const [toelichting, setToelichting] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState('')

  async function verstuur(besluit: Besluit) {
    setFout('')
    const euro = Number(bedrag.replace(',', '.'))
    if (besluit === 'toekennen' && !(euro > 0)) return setFout('Vul een bedrag in')
    if (!toelichting.trim()) return setFout('Geef een toelichting')
    if (!window.confirm(besluit === 'toekennen' ? `Toekennen: € ${bedrag} excl. btw. Dit is definitief.` : VRAAG[besluit])) return
    setBezig(true)
    const res = await fetch('/api/admin/referrals/besluit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralId, besluit, toelichting, nettoCent: besluit === 'toekennen' ? Math.round(euro * 100) : null }),
    }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setBezig(false)
    if (!res?.ok) return setFout(data?.error ?? 'Opslaan mislukt')
    if (data?.mijlpalen?.length) window.alert(`Mijlpaal gehaald: ${data.mijlpalen.join(', ')} toekenningen`)
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {!verval && <input style={{ ...veld, width: 130 }} inputMode="decimal" placeholder="€ excl. btw" value={bedrag} onChange={e => setBedrag(e.target.value)} />}
      <input style={{ ...veld, flex: 1, minWidth: 180 }} placeholder="Toelichting" maxLength={300} value={toelichting} onChange={e => setToelichting(e.target.value)} />
      <button style={knop} disabled={bezig} onClick={() => verstuur(verval ? 'behouden' : 'toekennen')}>{verval ? 'BEHOUDEN' : 'TOEKENNEN'}</button>
      <button style={knopStil} disabled={bezig} onClick={() => verstuur(verval ? 'vervallen' : 'afwijzen')}>{verval ? 'LATEN VERVALLEN' : 'AFWIJZEN'}</button>
      {fout && <span style={{ color: '#cc4444', width: '100%' }}>{fout}</span>}
    </div>
  )
}
