import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminNav from '../AdminNav'
import VoiceTestClient from './VoiceTestClient'

export const dynamic = 'force-dynamic'

export default async function VoiceTestPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/voice-test" />
      <VoiceTestClient />
    </main>
  )
}
