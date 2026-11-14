import Link from 'next/link'

// De twee blogpagina's in de admin vormen samen één menu-item (BLOG): de posts zelf en de
// blogideeën die uit de gesprekken komen. Dit zijn de tabs erboven, op beide pagina's gelijk.
export default function BlogTabs({ actief }: { actief: 'posts' | 'ideeen' }) {
  const tabs = [
    { key: 'posts', href: '/bot/admin/blog', label: 'POSTS' },
    { key: 'ideeen', href: '/bot/admin/idee', label: 'IDEEËN UIT GESPREKKEN' },
  ] as const
  return (
    <div style={{ display: 'flex', gap: 28, marginBottom: 32, borderBottom: '1px solid #374151' }}>
      {tabs.map(t => (
        <Link key={t.key} href={t.href}
          style={{
            fontSize: 12, letterSpacing: 3, fontWeight: 700, textDecoration: 'none', paddingBottom: 12, marginBottom: -1,
            color: actief === t.key ? '#f59e0b' : '#6b7280',
            borderBottom: actief === t.key ? '2px solid #f59e0b' : '2px solid transparent',
          }}>
          {t.label}
        </Link>
      ))}
    </div>
  )
}
