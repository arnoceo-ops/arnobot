import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminNav from '../AdminNav'
import AnalyseClient from './AnalyseClient'

export const dynamic = 'force-dynamic'

export default async function AnalysePage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const params = await searchParams

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/analyse" />
      <AnalyseClient initialUserId={params.userId ?? null} />
    </main>
  )
}
