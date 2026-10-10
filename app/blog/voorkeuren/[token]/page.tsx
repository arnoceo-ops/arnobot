import type { Metadata } from 'next'
import { countTags, getPublishedPosts } from '@/lib/blog'
import { BLOG_COPY } from '@/lib/blogCopy'
import { getPreferences, isTokenShape } from '@/lib/blogSubscribers'
import PreferencesClient from './PreferencesClient'

const C = BLOG_COPY.voorkeuren

export const metadata: Metadata = {
  title: 'Je onderwerpen | ArnoBot Blog',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function VoorkeurenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const prefs = isTokenShape(token) ? await getPreferences(token) : null

  if (!prefs) {
    return (
      <main className="bl-narrow">
        <h1 className="bl-title">{C.kop}</h1>
        <p role="alert" className="bl-sub">{C.ongeldig}</p>
      </main>
    )
  }

  const available = countTags(await getPublishedPosts()).map(t => t.tag)
  // Een eerder gekozen onderwerp dat inmiddels geen posts meer heeft blijft zichtbaar, zodat het
  // niet ongemerkt verdwijnt bij opslaan.
  const topics = [...new Set([...available, ...prefs.topics])]

  return <PreferencesClient token={token} topics={topics} initial={prefs.topics} />
}
