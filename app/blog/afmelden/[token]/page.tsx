import type { Metadata } from 'next'
import Link from 'next/link'
import { BLOG_COPY } from '@/lib/blogCopy'
import { isTokenShape } from '@/lib/blogSubscribers'
import TokenAction from '../../TokenAction'

const C = BLOG_COPY.afmelden

export const metadata: Metadata = {
  title: 'Afmelden | ArnoBot Blog',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function AfmeldenPage({ params }: { params: Promise<{ token: string }> }) {
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
      token={token} endpoint="/api/blog/unsubscribe"
      kop={C.kop} tekst={C.tekst} knop={C.knop} gelukt={C.gelukt} ongeldig={C.ongeldig} fout={C.fout}
    >
      <p className="bl-small" style={{ marginTop: 28 }}>
        <Link href={`/blog/voorkeuren/${token}`}>{C.voorkeuren}</Link>
      </p>
    </TokenAction>
  )
}
