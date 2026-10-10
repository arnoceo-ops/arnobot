import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { BLOG_BASE_URL, getPublishedPosts, getPublishedPostBySlug, relatedPosts } from '@/lib/blog'
import { renderMarkdown } from '@/lib/blogMarkdown'
import { isValidSlug, readingMinutes } from '@/lib/blogText'
import { BLOG_COPY } from '@/lib/blogCopy'
import SignupCTA from '../../components/SignupCTA'
import BlogCard, { formatBlogDate } from '../BlogCard'
import SubscribeBox from '../SubscribeBox'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = isValidSlug(slug) ? await getPublishedPostBySlug(slug) : null
  if (!post) return { robots: { index: false, follow: false } }

  const url = `${BLOG_BASE_URL}/blog/${post.slug}`
  const title = `${post.title} | ArnoBot Blog`
  const description = post.summary || BLOG_COPY.overzicht.metaBeschrijving
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'ArnoBot',
      locale: 'nl_NL',
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      tags: post.tags,
      images: post.cover_image_url ?? '/opengraph-image',
    },
    twitter: { card: 'summary_large_image' },
  }
}

// JSON-LD staat in een <script>: "<" escapen voorkomt dat tekst uit een post het blok kan
// afsluiten.
function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  // Gereserveerde namen (tag, bevestig, ...) en ongeldige slugs zijn nooit een post.
  if (!isValidSlug(slug)) notFound()
  const post = await getPublishedPostBySlug(slug)

  if (!post) {
    // Oude arno.blog-links die ooit onder arno.bot/blog hingen blijven werken. Bewust een
    // tijdelijke redirect: een permanente zou in de browser blijven hangen als er later
    // alsnog een post met deze slug verschijnt.
    redirect(`https://arno.blog/blog/${slug}`)
  }

  const all = await getPublishedPosts()
  const related = relatedPosts(post, all)
  const html = renderMarkdown(post.body_md)
  const url = `${BLOG_BASE_URL}/blog/${post.slug}`

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.summary || undefined,
    image: post.cover_image_url ?? `${BLOG_BASE_URL}/opengraph-image`,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    inLanguage: 'nl-NL',
    keywords: post.tags.join(', ') || undefined,
    mainEntityOfPage: url,
    author: { '@type': 'Person', name: 'Arno Diepeveen' },
    publisher: { '@type': 'Organization', name: 'ArnoBot', url: BLOG_BASE_URL, logo: { '@type': 'ImageObject', url: `${BLOG_BASE_URL}/arnobot-logo.png` } },
  }

  return (
    <main className="bl-narrow">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />

      <Link href="/blog" className="bl-back">← {BLOG_COPY.artikel.terug}</Link>

      <article>
        <header>
          <h1 className="bl-article-title">{post.title}</h1>
          <p className="bl-meta">
            <span>{formatBlogDate(post.published_at)}</span>
            <span>{BLOG_COPY.artikel.leestijd(readingMinutes(post.body_md))}</span>
            {post.tags.map(t => <Link key={t} href={`/blog/tag/${t}`}>#{t}</Link>)}
          </p>
        </header>

        {post.cover_image_url && (
          <div className="bl-cover">
            <Image src={post.cover_image_url} alt="" fill priority sizes="(max-width: 768px) 100vw, 720px" style={{ objectFit: 'cover' }} />
          </div>
        )}

        {/* Veilig: renderMarkdown escapet ruwe HTML en filtert URL-schema's (lib/blogMarkdown.ts). */}
        <div className="bl-body" dangerouslySetInnerHTML={{ __html: html }} />
      </article>

      <section className="bl-box" aria-labelledby="bl-cta-title">
        <h2 id="bl-cta-title">{BLOG_COPY.cta.kop}</h2>
        <p>{BLOG_COPY.cta.tekst}</p>
        <div className="bl-row" style={{ marginTop: 20 }}>
          <SignupCTA className="bl-btn">{BLOG_COPY.cta.primair}</SignupCTA>
          <Link href="/prijzen" className="bl-btn-secondary">{BLOG_COPY.cta.secundair}</Link>
        </div>
      </section>

      <SubscribeBox />

      {related.length > 0 && (
        <section className="bl-related">
          <h2>{BLOG_COPY.artikel.gerelateerd}</h2>
          <div className="bl-grid">
            {related.map(p => <BlogCard key={p.id} post={p} />)}
          </div>
        </section>
      )}
    </main>
  )
}
