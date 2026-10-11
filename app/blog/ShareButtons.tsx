'use client'

import { useState } from 'react'
import { BLOG_COPY } from '@/lib/blogCopy'

const C = BLOG_COPY.deel

// Delen onder een artikel: een link naar LinkedIn (de deelpagina van LinkedIn zelf, geen script en
// geen tracking van onze kant) en een knop om de link te kopiëren. Niet afhankelijk van een externe
// bibliotheek, dus ook geen extra privacyoppervlak.
export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<'idle' | 'gekopieerd' | 'fout'>('idle')
  const linkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  // wa.me werkt op de telefoon (opent WhatsApp) en op de computer (WhatsApp Web).
  const whatsApp = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(url)
      setState('gekopieerd')
    } catch {
      setState('fout')
    }
    setTimeout(() => setState('idle'), 3000)
  }

  return (
    <div className="bl-share">
      <p className="bl-share-kop">{C.kop}</p>
      <div className="bl-row" style={{ alignItems: 'center' }}>
        <a href={whatsApp} target="_blank" rel="noopener noreferrer" className="bl-btn-secondary">{C.whatsapp}</a>
        <a href={linkedIn} target="_blank" rel="noopener noreferrer" className="bl-btn-secondary">{C.linkedin}</a>
        <button type="button" className="bl-btn-secondary" onClick={kopieer}>{C.kopieer}</button>
        {state === 'gekopieerd' && <span role="status" className="bl-msg">{C.gekopieerd}</span>}
        {state === 'fout' && <span role="alert" className="bl-msg err">{C.fout}</span>}
      </div>
    </div>
  )
}
