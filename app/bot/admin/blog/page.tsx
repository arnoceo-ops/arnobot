import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import AdminNav from '../AdminNav'
import { getBlogDb } from '@/lib/blog'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = { draft: 'CONCEPT', scheduled: 'INGEPLAND', published: 'GEPUBLICEERD' }
const STATUS_COLOR: Record<string, string> = { draft: '#6b7280', scheduled: '#f59e0b', published: '#10b981' }

function fmt(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam' })
}

export default async function AdminBlogPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const db = getBlogDb()
  const [{ data: posts }, confirmed, pending] = await Promise.all([
    db.from('arnobot_blog_posts')
      .select('id, slug, title, tags, status, publish_at, published_at, updated_at')
      .order('updated_at', { ascending: false }),
    db.from('arnobot_blog_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    db.from('arnobot_blog_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const th = { textAlign: 'left' as const, fontSize: 12, letterSpacing: 2, color: '#6b7280', fontWeight: 700, padding: '8px 12px', borderBottom: '1px solid #1e293b' }
  const td = { fontSize: 14, color: '#f1f5f9', padding: '14px 12px', borderBottom: '1px solid #1e293b', verticalAlign: 'top' as const }

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/blog" />
      <div className="admin-content" style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 40px 80px' }}>
        <p style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: 48, fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-1px' }}>Posts</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 32 }}>
          De publieke blog op arno.bot/blog. Abonnees: {confirmed.count ?? 0} bevestigd, {pending.count ?? 0} wacht op bevestiging.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <Link href="/bot/admin/blog/nieuw" style={{ background: '#f59e0b', color: '#111827', fontSize: 12, fontWeight: 700, letterSpacing: 3, padding: '10px 20px', borderRadius: 4, textDecoration: 'none' }}>NIEUWE POST</Link>
          <a href="/blog" target="_blank" rel="noopener noreferrer" style={{ border: '1px solid #374151', color: '#9ca3af', fontSize: 12, fontWeight: 700, letterSpacing: 3, padding: '10px 20px', borderRadius: 4, textDecoration: 'none' }}>BEKIJK BLOG</a>
        </div>

        {!posts || posts.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>Nog geen posts. Maak je eerste post aan.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>TITEL</th>
                <th style={th}>STATUS</th>
                <th style={th}>TAGS</th>
                <th style={th}>DATUM</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p: { id: string; slug: string; title: string; tags: string[]; status: string; publish_at: string | null; published_at: string | null; updated_at: string }) => (
                <tr key={p.id}>
                  <td style={td}>
                    <Link href={`/bot/admin/blog/${p.id}`} style={{ color: '#f1f5f9', textDecoration: 'none', fontWeight: 700 }}>{p.title}</Link>
                    <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>/blog/{p.slug}</div>
                  </td>
                  <td style={{ ...td, color: STATUS_COLOR[p.status] ?? '#6b7280', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>{STATUS_LABEL[p.status] ?? p.status}</td>
                  <td style={{ ...td, color: '#9ca3af' }}>{p.tags.map(t => `#${t}`).join(' ')}</td>
                  <td style={{ ...td, color: '#9ca3af' }}>
                    {p.status === 'scheduled' ? fmt(p.publish_at) : p.status === 'published' ? fmt(p.published_at) : fmt(p.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
