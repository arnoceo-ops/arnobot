import type { Metadata } from 'next'
import { countTags, getPublishedPosts } from '@/lib/blog'
import { BLOG_COPY } from '@/lib/blogCopy'
import BlogCard from './BlogCard'
import BrandText from './BrandText'
import TagChips from './TagChips'
import SubscribeBox from './SubscribeBox'

const C = BLOG_COPY.overzicht

export const metadata: Metadata = {
  title: C.metaTitel,
  description: C.metaBeschrijving,
  robots: { index: true, follow: true },
  alternates: {
    canonical: 'https://www.arno.bot/blog',
    types: { 'application/rss+xml': 'https://www.arno.bot/blog/feed.xml' },
  },
  openGraph: {
    title: C.metaTitel,
    description: C.metaBeschrijving,
    url: 'https://www.arno.bot/blog',
    siteName: 'ArnoBot',
    locale: 'nl_NL',
    type: 'website',
    images: '/opengraph-image',
  },
  twitter: { card: 'summary_large_image' },
}

export default async function BlogOverviewPage({ searchParams }: { searchParams: Promise<{ bevestigd?: string }> }) {
  const { bevestigd } = await searchParams
  const posts = await getPublishedPosts()
  const tags = countTags(posts)

  return (
    <main className="bl-wrap">
      {/* Melding na de klik op de bevestiglink in de mail (zie app/api/blog/bevestig/route.ts). */}
      {bevestigd === '1' && <p role="status" className="bl-notice">{BLOG_COPY.bevestig.gelukt}</p>}
      {bevestigd === '0' && <p role="alert" className="bl-notice err">{BLOG_COPY.bevestig.ongeldig}</p>}
      <p className="bl-label">{C.label}</p>
      <h1 className="bl-title"><BrandText>{C.titel}</BrandText></h1>
      <p className="bl-sub">{C.sub}</p>

      <TagChips tags={tags} />

      {posts.length === 0 ? (
        C.leeg ? <p className="bl-empty">{C.leeg}</p> : null
      ) : (
        <div className="bl-grid">
          {posts.map(p => <BlogCard key={p.id} post={p} />)}
        </div>
      )}

      <SubscribeBox topics={tags.map(t => t.tag)} />
    </main>
  )
}
