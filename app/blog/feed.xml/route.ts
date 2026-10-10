import { BLOG_BASE_URL, getBlogReadDb, type BlogPost } from '@/lib/blog'
import { renderMarkdown } from '@/lib/blogMarkdown'
import { BLOG_COPY } from '@/lib/blogCopy'

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// RSS 2.0 met de volledige tekst. Relatieve links in een post worden absoluut gemaakt,
// anders werken ze niet in een feedreader. CDATA mag zelf geen "]]>" bevatten.
export async function GET() {
  const { data, error } = await getBlogReadDb()
    .from('arnobot_blog_posts')
    .select('slug, title, summary, body_md, tags, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50)
  if (error) return new Response('Feed niet beschikbaar', { status: 503 })

  const posts = (data ?? []) as Pick<BlogPost, 'slug' | 'title' | 'summary' | 'body_md' | 'tags' | 'published_at'>[]
  const items = posts.map(p => {
    const link = `${BLOG_BASE_URL}/blog/${p.slug}`
    const html = renderMarkdown(p.body_md)
      .replace(/(href|src)="\//g, `$1="${BLOG_BASE_URL}/`)
      .replace(/\]\]>/g, ']]&gt;')
    return `    <item>
      <title>${xml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(p.published_at ?? Date.now()).toUTCString()}</pubDate>
      <description>${xml(p.summary)}</description>
${p.tags.map(t => `      <category>${xml(t)}</category>`).join('\n')}
      <content:encoded><![CDATA[${html}]]></content:encoded>
    </item>`
  }).join('\n')

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(BLOG_COPY.overzicht.metaTitel)}</title>
    <link>${BLOG_BASE_URL}/blog</link>
    <description>${xml(BLOG_COPY.overzicht.metaBeschrijving)}</description>
    <language>nl-NL</language>
    <atom:link href="${BLOG_BASE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  })
}
