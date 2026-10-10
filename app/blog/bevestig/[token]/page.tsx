import type { Metadata } from 'next'
import { BLOG_COPY } from '@/lib/blogCopy'
import { isTokenShape } from '@/lib/blogSubscribers'
import TokenAction from '../../TokenAction'

const C = BLOG_COPY.bevestig

// Bevat een geheim token in het pad: nooit indexeren en geen referrer meesturen.
export const metadata: Metadata = {
  title: 'Bevestig je aanmelding | ArnoBot Blog',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function BevestigPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isTokenShape(token)) {
    return (
      <main className="bl-narrow">
        <h1 className="bl-title">{C.kop}</h1>
        <p role="alert" className="bl-sub">{C.ongeldig}</p>
      </main>
    )
  }
  return (
    <TokenAction
      token={token} endpoint="/api/blog/confirm"
      kop={C.kop} tekst={C.tekst} knop={C.knop} gelukt={C.gelukt} ongeldig={C.ongeldig} fout={C.fout}
    />
  )
}
