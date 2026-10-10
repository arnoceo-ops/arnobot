'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BLOG_COPY } from '@/lib/blogCopy'

const C = BLOG_COPY.abonneer

// Aanmeldformulier voor de blogmails. Double opt-in: dit formulier maakt alleen een
// aanmelding in afwachting, pas de bevestigingsklik in de mail activeert hem.
export default function SubscribeBox({ topics }: { topics: string[] }) {
  const [email, setEmail] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [website, setWebsite] = useState('') // honeypot: echte bezoekers laten dit leeg
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState('')

  function toggle(tag: string) {
    setChosen(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'loading') return
    setError('')
    setState('loading')
    try {
      const res = await fetch('/api/blog/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, topics: chosen, website }),
      })
      if (res.ok) { setState('done'); return }
      setState('idle')
      setError(res.status === 400 ? C.ongeldigEmail : res.status === 429 ? C.teVaak : C.fout)
    } catch {
      setState('idle')
      setError(C.fout)
    }
  }

  return (
    <section className="bl-box" aria-labelledby="bl-sub-title">
      <h2 id="bl-sub-title">{C.kop}</h2>
      {state === 'done' ? (
        <p role="status" className="bl-msg" style={{ marginTop: 12 }}>{C.gelukt}</p>
      ) : (
        <>
          <p>{C.tekst}</p>
          <form className="bl-form" onSubmit={submit} noValidate>
            {topics.length > 0 && (
              <div>
                <p className="bl-small" style={{ marginBottom: 8 }}>{C.onderwerpenLabel}</p>
                <div className="bl-topics">
                  <button type="button" className="bl-topic" aria-pressed={chosen.length === 0} onClick={() => setChosen([])}>{C.alles}</button>
                  {topics.map(t => (
                    <button key={t} type="button" className="bl-topic" aria-pressed={chosen.includes(t)} onClick={() => toggle(t)}>#{t}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="bl-hp" aria-hidden="true">
              <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
            </div>
            <div className="bl-row">
              <input
                className="bl-input" type="email" inputMode="email" autoComplete="email" required
                placeholder={C.emailPlaceholder} aria-label={C.emailPlaceholder}
                value={email} onChange={e => setEmail(e.target.value)} maxLength={254}
              />
              <button type="submit" className="bl-btn" disabled={state === 'loading'}>
                {state === 'loading' ? C.bezig : C.knop}
              </button>
            </div>
            {error && <p role="alert" className="bl-msg err">{error}</p>}
            <p className="bl-small">
              {C.privacy} <Link href="/privacy">{C.privacyLink}</Link>
            </p>
          </form>
        </>
      )}
    </section>
  )
}
