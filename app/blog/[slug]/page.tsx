import { client } from '@/sanity/client'
import { PortableText } from '@portabletext/react'
import imageUrlBuilder from '@sanity/image-url'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const builder = imageUrlBuilder(client)
function urlFor(source: unknown) {
  return builder.image(source as Parameters<typeof builder.image>[0])
}

function decodeHtml(str: string): string {
  return (str || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

interface Post {
  title: string
  publishedAt: string
  body: import('@portabletext/types').PortableTextBlock[]
  coverImage: Record<string, unknown> | null
}

interface NavPost {
  title: string
  slug: { current: string }
}

async function getPost(slug: string): Promise<Post> {
  return client.fetch(
    `*[_type == "post" && slug.current == $slug][0] {
      title, publishedAt, body, coverImage
    }`,
    { slug }
  )
}

async function getAdjacentPosts(slug: string): Promise<{ prev: NavPost | null, next: NavPost | null }> {
  const all = await client.fetch(
    `*[_type == "post"] | order(publishedAt desc) { title, slug, publishedAt }`
  )
  const index = all.findIndex((p: { slug: { current: string } }) => p.slug.current === slug)
  return {
    prev: index < all.length - 1 ? all[index + 1] : null,
    next: index > 0 ? all[index - 1] : null,
  }
}

const portableTextComponents = {
  block: {
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="body-p">{children}</p>
    ),
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="body-h1">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="body-h2">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="body-h3">{children}</h3>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="body-quote">{children}</blockquote>
    ),
  },
  marks: {
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong style={{ color: '#f1f5f9', fontWeight: 700 }}>{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em style={{ color: '#f59e0b', fontStyle: 'normal' }}>{children}</em>
    ),
    link: ({ value, children }: { value?: { href: string }, children?: React.ReactNode }) => (
      <a href={value?.href} target="_blank" rel="noopener noreferrer" className="body-link">
        {children}
      </a>
    ),
  },
  list: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <ul className="body-ul">{children}</ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="body-ol">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <li className="body-li">{children}</li>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <li className="body-li">{children}</li>
    ),
  },
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const { slug } = await params
  const [post, { prev, next }] = await Promise.all([
    getPost(slug),
    getAdjacentPosts(slug),
  ])

  if (!post) {
    return (
      <div style={{ background: '#111827', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', fontFamily: 'Space Mono, monospace' }}>
          <p style={{ color: '#f59e0b', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase' }}>404</p>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '80px', color: '#f1f5f9', margin: '16px 0' }}>Post niet gevonden</h1>
          <Link href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase' }}>← Terug naar home</Link>
        </div>
      </div>
    )
  }

  const title = decodeHtml(post.title)
  const date = new Date(post.publishedAt).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@300;600;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; }

        .post-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          padding: 20px 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #1e293b;
          background: rgba(17,24,39,0.95);
          backdrop-filter: blur(10px);
        }
        .nav-logo {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px;
          letter-spacing: 3px;
          color: #f59e0b;
          text-decoration: none;
        }
        .back-link {
          color: #6b7280;
          text-decoration: none;
          font-size: 11px;
          letter-spacing: 3px;
          text-transform: uppercase;
          font-family: 'Space Mono', monospace;
          transition: color 0.2s;
        }
        .back-link:hover { color: #f59e0b; }

        .post-hero {
          padding-top: 80px;
          background: #111827;
        }
        .post-hero-inner {
          max-width: 800px;
          margin: 0 auto;
          padding: 80px 60px 60px;
        }
        .post-label {
          font-size: 11px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: #f59e0b;
          font-family: 'Space Mono', monospace;
          margin-bottom: 24px;
          display: block;
        }
        .post-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(48px, 7vw, 96px);
          line-height: 0.95;
          letter-spacing: -1px;
          color: #f1f5f9;
          margin-bottom: 40px;
        }
        .post-meta {
          display: flex;
          align-items: center;
          gap: 24px;
          padding-bottom: 40px;
          border-bottom: 1px solid #1e293b;
        }
        .post-date {
          font-size: 11px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #6b7280;
          font-family: 'Space Mono', monospace;
        }
        .post-divider {
          width: 40px;
          height: 1px;
          background: #f59e0b;
        }
        .post-author {
          font-size: 11px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #9ca3af;
          font-family: 'Space Mono', monospace;
        }

        .post-cover {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          padding: 0 60px 60px;
        }
        .post-cover img {
          width: 100%;
          height: auto;
          display: block;
        }

        .post-body {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 60px 80px;
        }

        .body-p {
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          line-height: 2.2;
          color: #9ca3af;
          margin-bottom: 28px;
        }
        .body-h1 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 48px;
          color: #f1f5f9;
          margin: 60px 0 24px;
          letter-spacing: 1px;
        }
        .body-h2 {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 36px;
          color: #f1f5f9;
          margin: 48px 0 20px;
          letter-spacing: 1px;
        }
        .body-h3 {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 36px 0 16px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .body-quote {
          border-left: 3px solid #f59e0b;
          padding: 4px 0 4px 32px;
          margin: 40px 0;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 28px;
          font-weight: 600;
          color: #f1f5f9;
          line-height: 1.4;
        }
        .body-link {
          color: #f59e0b;
          text-decoration: none;
          border-bottom: 1px solid rgba(245,158,11,0.3);
          transition: border-color 0.2s;
        }
        .body-link:hover { border-color: #f59e0b; }
        .body-ul, .body-ol {
          margin: 0 0 28px 0;
          padding-left: 0;
          list-style: none;
        }
        .body-li {
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          line-height: 2.2;
          color: #9ca3af;
          padding-left: 24px;
          position: relative;
          margin-bottom: 8px;
        }
        .body-li::before {
          content: '→';
          position: absolute;
          left: 0;
          color: #f59e0b;
        }

        /* ── POST NAVIGATION ── */
        .post-nav-bottom {
          border-top: 1px solid #1e293b;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .post-nav-prev,
        .post-nav-next {
          padding: 40px 60px;
          text-decoration: none;
          color: #f1f5f9;
          transition: background 0.2s;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .post-nav-prev:hover,
        .post-nav-next:hover {
          background: #1f2937;
        }
        .post-nav-next {
          border-left: 1px solid #1e293b;
          text-align: right;
          align-items: flex-end;
        }
        .post-nav-arrow {
          font-size: 32px;
          color: #f59e0b;
          line-height: 1;
        }
        .post-nav-label {
          font-size: 10px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #444;
          font-family: 'Space Mono', monospace;
        }
        .post-nav-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 600;
          font-size: 18px;
          color: #f1f5f9;
          line-height: 1.3;
        }
        .post-nav-empty {
          padding: 40px 60px;
        }
      `}</style>

      <nav className="post-nav">
        <Link href="/" className="nav-logo">Royal Dutch Sales</Link>
        <Link href="/" className="back-link">← Home</Link>
      </nav>

      <div className="post-hero">
        <div className="post-hero-inner">
          <span className="post-label">Royal Dutch Sales · arno.blog</span>
          <h1 className="post-title">{title}</h1>
          <div className="post-meta">
            <span className="post-date">{date}</span>
            <div className="post-divider" />
            <span className="post-author">Arno Diepeveen</span>
          </div>
        </div>
      </div>

      {post.coverImage && (
        <div className="post-cover">
          <img src={urlFor(post.coverImage).width(800).url()} alt={title} />
        </div>
      )}

      <div className="post-body">
        <PortableText value={post.body} components={portableTextComponents} />
      </div>

      {/* PREV / NEXT NAVIGATIE */}
      <div className="post-nav-bottom">
        {prev ? (
          <Link href={`/blog/${prev.slug.current}`} className="post-nav-prev">
            <span className="post-nav-arrow">←</span>
            <span className="post-nav-label">Vorige post</span>
            <span className="post-nav-title">{decodeHtml(prev.title)}</span>
          </Link>
        ) : (
          <div className="post-nav-empty" />
        )}
        {next ? (
          <Link href={`/blog/${next.slug.current}`} className="post-nav-next">
            <span className="post-nav-arrow">→</span>
            <span className="post-nav-label">Volgende post</span>
            <span className="post-nav-title">{decodeHtml(next.title)}</span>
          </Link>
        ) : (
          <div className="post-nav-empty" />
        )}
      </div>
    </>
  )
}
