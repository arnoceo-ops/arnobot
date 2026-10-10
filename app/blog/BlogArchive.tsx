'use client'

import { useMemo, useState } from 'react'
import type { BlogPostListItem } from '@/lib/blog'
import { filterPosts } from '@/lib/blogSearch'
import { BLOG_COPY } from '@/lib/blogCopy'
import BlogCard from './BlogCard'

const C = BLOG_COPY.overzicht
const PAGE_SIZE = 12

// Het archief: alle gepubliceerde posts, doorzoekbaar op hashtag en trefwoord. Zoeken gebeurt
// direct in de browser op de al geladen lijst. Er worden steeds 12 kaarten getoond met een knop
// voor meer, zodat de pagina snel blijft bij een groot archief. De zoekterm staat in de URL
// (?q=...), zodat een gefilterd overzicht te delen is.
export default function BlogArchive({ posts, initialQuery }: { posts: BlogPostListItem[]; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const results = useMemo(() => filterPosts(posts, query), [posts, query])
  const searching = query.trim() !== ''

  function onChange(value: string) {
    setQuery(value)
    setVisible(PAGE_SIZE)
    try {
      const path = window.location.pathname
      window.history.replaceState(null, '', value.trim() ? `${path}?q=${encodeURIComponent(value)}` : path)
    } catch { /* URL bijwerken is een gemak, zoeken werkt ook zonder */ }
  }

  return (
    <>
      <div className="bl-search">
        <input
          className="bl-input" type="search" value={query} maxLength={100}
          onChange={e => onChange(e.target.value)}
          placeholder={C.zoekPlaceholder} aria-label={C.zoekPlaceholder}
        />
        {searching && (
          <p role="status" className="bl-small" style={{ marginTop: 10 }}>{C.resultaten(results.length)}</p>
        )}
      </div>

      {results.length === 0 ? (
        <p className="bl-empty">{C.geenResultaat}</p>
      ) : (
        <div className="bl-grid">
          {results.slice(0, visible).map(p => <BlogCard key={p.id} post={p} />)}
        </div>
      )}

      {results.length > visible && (
        <p style={{ marginTop: 32, textAlign: 'center' }}>
          <button type="button" className="bl-btn-secondary" onClick={() => setVisible(v => v + PAGE_SIZE)}>{C.toonMeer}</button>
        </p>
      )}
    </>
  )
}
