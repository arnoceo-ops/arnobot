import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import EmailTestClient from './EmailTestClient'

const navLinkStyle = (active: boolean): React.CSSProperties => ({
  color: active ? '#f59e0b' : '#9ca3af',
  textDecoration: 'none',
  fontSize: '15px',
  letterSpacing: '3px',
  fontWeight: 700,
  padding: '6px 20px',
  borderRadius: 4,
  background: active ? '#1e293b' : 'none',
})

export default async function EmailsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <nav style={{ background: '#0d0d0d', borderBottom: '1px solid #1e293b', height: 56, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 40px' }}>
        <div />
        <div style={{ display: 'flex', gap: '4px' }}>
          <a href="/bot/admin/gebruikers" style={navLinkStyle(false)}>USERS</a>
          <a href="/bot/admin/emails" style={navLinkStyle(true)}>CRONS</a>
          <a href="/bot/admin" style={navLinkStyle(false)}>ARNOBOT</a>
          <a href="/bot/admin/idee" style={navLinkStyle(false)}>BLOGS</a>
          <a href="/bot/admin/evaluaties" style={navLinkStyle(false)}>FEEDBACK</a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, alignItems: 'center' }}>
          <a href="/bot/admin/widget" style={navLinkStyle(false)}>ARNO.BLOG</a>
          <a href="/api/admin/logout" style={{ color: '#4b5563', textDecoration: 'none', fontSize: 13, letterSpacing: 2, fontWeight: 700, padding: '6px 12px' }}>UITLOG</a>
        </div>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 40px' }}>
        <p style={{ color: '#f59e0b', fontSize: '13px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-1px' }}>Crons</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', letterSpacing: '2px', marginBottom: '48px' }}>
          Stuur een testversie van elk emailtemplate naar arno@arno.bot.
        </p>
        <EmailTestClient />
      </div>
    </main>
  )
}
