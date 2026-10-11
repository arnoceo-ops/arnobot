'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { BLOG_COPY } from '@/lib/blogCopy'
import { normalizeVoornaam } from '@/lib/blogText'
import { leesAangemeld, volgAangemeld, zetAangemeld } from '@/lib/blogClient'
import BrandText from './BrandText'

const C = BLOG_COPY.abonneer

// Aanmeldformulier voor de blogmails. Double opt-in: dit formulier maakt alleen een
// aanmelding in afwachting, pas de bevestigingsklik in de mail activeert hem.
export default function SubscribeBox() {
  const [email, setEmail] = useState('')
  const [voornaam, setVoornaam] = useState('')
  const [website, setWebsite] = useState('') // honeypot: echte bezoekers laten dit leeg
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState('')
  // Loaded-gate: op de server en tijdens het laden is de status 'onbekend' en tonen we niets, pas
  // daarna 'ja' (verbergen) of 'nee' (tonen). Zo ziet een aangemelde bezoeker het formulier niet
  // even knipperen. Na de bevestigingslink uit de mail (/blog?bevestigd=1) onthouden we de aanmelding.
  const status = useSyncExternalStore(volgAangemeld, () => (leesAangemeld() ? 'ja' : 'nee'), () => 'onbekend')

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('bevestigd') === '1') zetAangemeld(true)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'loading') return
    setError('')
    // Voornaam is verplicht (aanhef in de mails). Zelfde opschoning als de server, zodat een
    // naam met alleen cijfers of tekens meteen een duidelijke melding geeft.
    if (!normalizeVoornaam(voornaam)) { setError(C.voornaamVerplicht); return }
    setState('loading')
    try {
      const res = await fetch('/api/blog/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, voornaam, website }),
      })
      if (res.ok) { setState('done'); return }
      setState('idle')
      if (res.status === 400) {
        const data = await res.json().catch(() => ({}))
        setError(data.code === 'voornaam' ? C.voornaamVerplicht : C.ongeldigEmail)
      } else {
        setError(res.status === 429 ? C.teVaak : C.fout)
      }
    } catch {
      setState('idle')
      setError(C.fout)
    }
  }

  if (status !== 'nee') return null

  return (
    <section className="bl-box bl-sub-box" aria-labelledby="bl-sub-title">
      <h2 id="bl-sub-title">{state === 'done' ? C.geluktKop : <BrandText>{C.kop}</BrandText>}</h2>
      {state === 'done' ? (
        <p role="status" className="bl-msg" style={{ marginTop: 12 }}>{C.gelukt}</p>
      ) : (
        <>
          <p>{C.tekst}</p>
          <form className="bl-form" onSubmit={submit} noValidate>
            <div className="bl-hp" aria-hidden="true">
              <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
            </div>
            <div className="bl-row">
              <input
                className="bl-input" type="email" inputMode="email" autoComplete="email" required
                placeholder={C.emailPlaceholder} aria-label={C.emailPlaceholder}
                value={email} onChange={e => setEmail(e.target.value)} maxLength={254}
              />
            </div>
            <div className="bl-row">
              <input
                className="bl-input" type="text" autoComplete="given-name" maxLength={40} required
                placeholder={C.voornaamPlaceholder} aria-label={C.voornaamPlaceholder}
                value={voornaam} onChange={e => setVoornaam(e.target.value)}
              />
              <button type="submit" className="bl-btn" disabled={state === 'loading'}>
                {state === 'loading' ? C.bezig : C.knop}
              </button>
            </div>
            {error && <p role="alert" className="bl-msg err">{error}</p>}
            <p className="bl-small">{C.privacy}</p>
          </form>
        </>
      )}
    </section>
  )
}
