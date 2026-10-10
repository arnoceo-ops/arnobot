import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BLOG_BASE_URL, countTags, getPublishedPosts } from '@/lib/blog'
import { normalizeTag } from '@/lib/blogText'
import { BLOG_COPY } from '@/lib/blogCopy'
import BlogCard from '../../BlogCard'
import TagChips from '../../TagChips'
import SubscribeBox from '../../SubscribeBox'

type Props = { params: Promise<{ tag: string }> }

// Tagpagina's met weinig posts zijn dunne content voor zoekmachines: pas vanaf 3 posts
// indexeerbaar. Ze blijven wel gewoon bruikbaar voor bezoekers.
const MIN_POSTS_INDEXED = 3

async function load(raw: string) {
  // Een kapotte %-reeks in de URL mag geen 500 geven.
  let decoded = raw
  try { decoded = decodeURIComponent(raw) } catch { /* ongeldig: gebruik de ruwe waarde */ }
  const tag = normalizeTag(decoded)
  const posts = (await getPublishedPosts()).filter(p => p.tags.includes(tag))
  return { tag, posts }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag: raw } = await params
  const { tag, posts } = await load(raw)
  if (!tag || posts.length === 0) return { robots: { index: false, follow: false } }
  const title = `#${tag} | ArnoBot Blog`
  const description = BLOG_COPY.tag.sub(`#${tag}`)
  return {
    title,
    description,
    robots: { index: posts.length >= MIN_POSTS_INDEXED, follow: true },
    alternates: { canonical: `${BLOG_BASE_URL}/blog/tag/${tag}` },
    openGraph: { title, description, url: `${BLOG_BASE_URL}/blog/tag/${tag}`, siteName: 'ArnoBot', locale: 'nl_NL', type: 'website', images: '/opengraph-image' },
  }
}

export default async function BlogTagPage({ params }: Props) {
  const { tag: raw } = await params
  const { tag, posts } = await load(raw)
  if (!tag) notFound()
  // Hoofdletters of een voorloop-# in de URL: naar de nette vorm, geen dubbele pagina's.
  if (tag !== raw) redirect(`/blog/tag/${tag}`)
  if (posts.length === 0) notFound()

  const all = await getPublishedPosts()
  const tags = countTags(all)

  return (
    <main className="bl-wrap">
      <Link href="/blog" className="bl-back">← {BLOG_COPY.tag.terug}</Link>
      <p className="bl-label">{BLOG_COPY.overzicht.label}</p>
      <h1 className="bl-title">#{tag}</h1>
      <p className="bl-sub">{BLOG_COPY.tag.sub(`#${tag}`)}</p>

      <TagChips tags={tags} active={tag} />

      <div className="bl-grid">
        {posts.map(p => <BlogCard key={p.id} post={p} />)}
      </div>

      <SubscribeBox />
    </main>
  )
}
