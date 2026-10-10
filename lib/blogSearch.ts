import type { BlogPostListItem } from './blog'

// Zoeken in het blogarchief, volledig in de browser op de al geladen lijst. Geen databaseaanroep
// per toetsaanslag, dus het kost niets extra bij veel bezoekers.
//
// Regels: woorden worden gesplitst op spaties en moeten ALLE kloppen. Een woord met # ervoor is
// een hashtag en matcht het begin van een hashtag van de post (#spar vindt #sparren), zodat je
// al tijdens het typen resultaat ziet. Een woord zonder # zoekt in titel, samenvatting en
// hashtags. Hoofdletters en accenten maken niet uit.

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export type SearchablePost = Pick<BlogPostListItem, 'title' | 'summary' | 'tags'>

export function filterPosts<T extends SearchablePost>(posts: T[], query: string): T[] {
  const tokens = norm(query).split(/\s+/).filter(Boolean)
  const tagTokens = tokens.filter(t => t.startsWith('#')).map(t => t.replace(/^#+/, '')).filter(Boolean)
  const words = tokens.filter(t => !t.startsWith('#'))
  if (tagTokens.length === 0 && words.length === 0) return posts

  return posts.filter(p => {
    const tags = p.tags.map(norm)
    if (!tagTokens.every(tt => tags.some(t => t.startsWith(tt)))) return false
    if (words.length === 0) return true
    const haystack = `${norm(p.title)} ${norm(p.summary)} ${tags.join(' ')}`
    return words.every(w => haystack.includes(w))
  })
}
