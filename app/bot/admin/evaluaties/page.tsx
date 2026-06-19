import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import EvaluatiesClient from './EvaluatiesClient'

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

export default async function EvaluatiesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: evaluaties } = await supabase
    .from('arnobot_evaluaties')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <nav style={{ background: '#0d0d0d', borderBottom: '1px solid #1e293b', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <a href="/bot/admin" style={navLinkStyle(false)}>APP</a>
          <a href="/bot/admin/gebruikers" style={navLinkStyle(false)}>USERS</a>
          <a href="/bot/admin/evaluaties" style={navLinkStyle(true)}>EVALUATIES</a>
        </div>
        <a href="/bot/admin/widget" style={navLinkStyle(false)}>BLOG</a>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 40px' }}>
        <p style={{ color: '#f59e0b', fontSize: '13px', letterSpacing: '5px', marginBottom: '8px' }}>ARNOBOT</p>
        <h1 style={{ fontSize: '56px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-1px' }}>Evaluaties</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', letterSpacing: '2px', marginBottom: '48px' }}>
          {(evaluaties ?? []).length} ingevuld
        </p>

        <EvaluatiesClient evaluaties={evaluaties ?? []} />
      </div>
    </main>
  )
}
