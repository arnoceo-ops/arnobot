'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BLOG_COPY } from '@/lib/blogCopy'

const C = BLOG_COPY.voorkeuren

export default function PreferencesClient({ token, topics, initial }: { token: string; topics: string[]; initial: string[] }) {
  const [chosen, setChosen] = useState<string[]>(initial)
  const [state, setState] = useState<'idle' | 'loading' | 'saved' | 'error'>('idle')

  function toggle(tag: string) {
    setState('idle')
    setChosen(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  async function save() {
    if (state === 'loading') return
    setState('loading')
    try {
      const res = await fetch('/api/blog/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, topics: chosen }),
      })
      setState(res.ok ? 'saved' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <main className="bl-narrow">
      <h1 className="bl-title">{C.kop}</h1>
      <p className="bl-sub">{C.tekst}</p>

      <div className="bl-topics" style={{ marginTop: 28 }}>
        <button type="button" className="bl-topic" aria-pressed={chosen.length === 0} onClick={() => { setState('idle'); setChosen([]) }}>
          {BLOG_COPY.abonneer.alles}
        </button>
        {topics.map(t => (
          <button key={t} type="button" className="bl-topic" aria-pressed={chosen.includes(t)} onClick={() => toggle(t)}>#{t}</button>
        ))}
      </div>

      <div className="bl-row" style={{ marginTop: 32, alignItems: 'center' }}>
        <button type="button" className="bl-btn" onClick={save} disabled={state === 'loading'}>{C.knop}</button>
        {state === 'saved' && <span role="status" className="bl-msg">{C.opgeslagen}</span>}
        {state === 'error' && <span role="alert" className="bl-msg err">{C.fout}</span>}
      </div>

      <p className="bl-small" style={{ marginTop: 32 }}>
        <Link href={`/blog/afmelden/${token}`}>{C.afmelden}</Link>
      </p>
    </main>
  )
}
