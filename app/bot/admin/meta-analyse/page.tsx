import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import MetaAnalyseClient from './MetaAnalyseClient'
import AdminNav from '../AdminNav'

export const dynamic = 'force-dynamic'

export default async function MetaAnalisePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/meta-analyse" />

      <div className="admin-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 40px' }}>
        <p style={{ color: '#f59e0b', fontSize: '12px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-1px' }}>Meta-analyse</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 48, lineHeight: 1.7 }}>
          Hoe doet ArnoBot het als coach? Zelfbeoordeling door ArnoBot zelf, plus een jurering door vijf wereldberoemde experts: Marshall Goldsmith, Tony Robbins, Elon Musk, Daniel Kahneman en Jordan Belfort.
        </p>

        <MetaAnalyseClient />
      </div>
    </main>
  )
}
