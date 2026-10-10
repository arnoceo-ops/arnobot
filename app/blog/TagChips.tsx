import Link from 'next/link'

export default function TagChips({ tags, active }: { tags: { tag: string; count: number }[]; active?: string }) {
  if (tags.length === 0) return null
  return (
    <nav className="bl-chips" aria-label="Onderwerpen">
      {tags.map(t => (
        <Link key={t.tag} href={`/blog/tag/${t.tag}`} className={`bl-chip${active === t.tag ? ' active' : ''}`}>
          #{t.tag}
        </Link>
      ))}
    </nav>
  )
}
