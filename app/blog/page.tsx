import { client } from '@/sanity/client'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

interface Post {
  _id: string
  title: string
  slug: { current: string }
  publishedAt: string
}

function decodeHtml(str: string): string {
  return (str || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

async function getPosts(): Promise<Post[]> {
  const posts = await client.fetch(`*[_type == "post"] | order(publishedAt desc) { _id, title, slug, publishedAt }`)
  const seen = new Set<string>()
  return posts.filter((p: Post) => {
    const key = decodeHtml(p.title || '').toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default async function BlogPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const posts = await getPosts()

  const byYear: Record<string, Post[]> = {}
  for (const post of posts) {
    const year = new Date(post.publishedAt).getFullYear().toString()
    if (!byYear[year]) byYear[year] = []
    byYear[year].push(post)
  }
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a))

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@300;600;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; }

        .site-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 16px 40px; display: flex; justify-content: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(17,24,39,0.9); backdrop-filter: blur(12px);
        }
        .nav-links { display: flex; gap: 48px; align-items: center; }
        .nav-links a {
          color: #9ca3af; text-decoration: none; font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 3px; transition: color 0.2s;
        }
        .nav-links a:hover { color: #f1f5f9; }
        .nav-active { color: #f59e0b !important; }
        .nav-cta { color: #f59e0b !important; }

        .blog-header { padding-top: 80px; background: #111827; }
        .blog-header-inner {
          padding: 80px 60px 60px;
          border-bottom: 3px solid #f59e0b;
          display: flex; justify-content: space-between; align-items: flex-end;
        }
        .blog-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(64px, 10vw, 120px);
          line-height: 0.9; color: #f1f5f9;
        }
        .blog-title-orange { color: #f59e0b; }
        .blog-meta { text-align: right; padding-bottom: 8px; }
        .blog-count { font-family: 'Barlow', sans-serif; font-weight: 700; font-size: 26px; line-height: 39px; color: #f1f5f9; display: block; }
        .blog-count-label { font-family: 'Space Mono', monospace; font-weight: 400; font-size: 15px; line-height: 29px; color: #f1f5f9; display: block; }

        .archive { padding: 0 60px 80px; }
        .year-block { margin-top: 0; }
        .year-divider {
          display: grid; grid-template-columns: auto 1fr;
          align-items: center; gap: 24px; padding: 48px 0 0; margin-bottom: 0;
        }
        .year-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 100px; line-height: 1; color: #1e293b; letter-spacing: -2px; user-select: none;
        }
        .year-line { height: 1px; background: #1e293b; }

        .post-row {
          display: grid; grid-template-columns: 56px 1fr auto;
          align-items: baseline; gap: 24px;
          padding: 20px 60px; border-bottom: 1px solid #1f2937;
          text-decoration: none; color: #f1f5f9; transition: background 0.15s;
          margin: 0 -60px;
        }
        .post-row:hover { background: #f59e0b; color: #111827; }
        .post-row:hover .post-row-num { color: rgba(0,0,0,0.25); }
        .post-row:hover .post-row-date { color: rgba(0,0,0,0.5); }
        .post-row-num { font-family: 'Bebas Neue', sans-serif; font-size: 14px; color: #374151; transition: color 0.15s; }
        .post-row-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(22px, 2.5vw, 34px); line-height: 1; letter-spacing: 0.5px; }
        .post-row-date { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #4b5563; white-space: nowrap; transition: color 0.15s; }

        footer {
          background: #0d1117; padding: 40px 60px;
          display: flex; justify-content: space-between; align-items: center;
          border-top: 1px solid #1f2937;
        }
        .footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #f59e0b; letter-spacing: 3px; }
        .footer-copy { font-size: 10px; color: #374151; }
      `}</style>

      <nav className="site-nav">
        <div className="nav-links">
          <Link href="/">HOME</Link>
          <Link href="/bio">ARNO</Link>
          <a href="https://www.arno.bot/">BOT</a>
          <a href="https://salescanvas.app" target="_blank" rel="noopener noreferrer">CANVAS</a>
          <a href="https://arno.blog/subscribe" target="_blank" rel="noopener noreferrer" className="nav-cta">SUBSCRIBE</a>
        </div>
      </nav>

      <div className="blog-header">
        <div className="blog-header-inner">
          <h1 className="blog-title">
            ARNO<br />
            <span className="blog-title-orange">BLOG(T)</span>
          </h1>
          <div className="blog-meta">
            <span className="blog-count">500+</span>
            <span className="blog-count-label">Posts · Since 2007</span>
          </div>
        </div>
      </div>

      <div className="archive">
        {years.map((year) => {
          const yearPosts = byYear[year]
          return (
            <div key={year} className="year-block">
              <div className="year-divider">
                <span className="year-label">{year}</span>
                <div className="year-line" />
              </div>
              {yearPosts.map((post) => {
                const globalIdx = posts.findIndex(p => p._id === post._id)
                return (
                  <Link key={post._id} href={`/blog/${post.slug.current}`} className="post-row">
                    <span className="post-row-num">{String(globalIdx + 1).padStart(2, '0')}</span>
                    <span className="post-row-title">{decodeHtml(post.title)}</span>
                    <span className="post-row-date">
                      {new Date(post.publishedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>

      <footer>
        <span className="footer-logo">Royal Dutch Sales</span>
        <span className="footer-copy">© Since 2007 · CC BY-ND 4.0</span>
      </footer>
    </>
  )
}
