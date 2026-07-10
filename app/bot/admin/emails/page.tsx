import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import EmailTestClient from './EmailTestClient'
import AdminNav from '../AdminNav'

export const dynamic = 'force-dynamic'

export default async function EmailsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/emails" />

      <div className="admin-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 40px' }}>
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
