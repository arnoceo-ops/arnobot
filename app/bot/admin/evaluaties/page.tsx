import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
import EvaluatiesClient from './EvaluatiesClient'
import AdminNav from '../AdminNav'

export default async function EvaluatiesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arnobot_admin')?.value
  if (!token || token !== process.env.ARNOBOT_ADMIN_KEY) redirect('/bot/admin/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: evaluaties }, { data: ratingsRaw }, { data: negRaw }] = await Promise.all([
    supabase.from('arnobot_evaluaties').select('*').order('created_at', { ascending: false }),
    supabase.from('arnobot_rds_logs').select('feedback').not('feedback', 'is', null),
    supabase
      .from('arnobot_rds_logs')
      .select('question, answer, created_at, user_id')
      .eq('feedback', 'neg')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const userIds = [...new Set((negRaw ?? []).map((r: { user_id: string | null }) => r.user_id).filter(Boolean))] as string[]
  const { data: users } = userIds.length
    ? await supabase.from('approved_users').select('user_id, voornaam, achternaam').in('user_id', userIds)
    : { data: [] }
  const userMap = Object.fromEntries(
    (users ?? []).map((u: { user_id: string; voornaam: string | null; achternaam: string | null }) => [
      u.user_id,
      [u.voornaam, u.achternaam].filter(Boolean).join(' ') || null,
    ])
  )
  const negativeRatings = (negRaw ?? []).map((r: { question: string; answer: string; created_at: string; user_id: string | null }) => ({
    question: r.question,
    answer: r.answer,
    created_at: r.created_at,
    user_name: r.user_id ? (userMap[r.user_id] ?? null) : null,
  }))

  const totalRatings = (ratingsRaw ?? []).length
  const positiveRatings = (ratingsRaw ?? []).filter((r: { feedback: string }) => r.feedback === 'pos').length

  return (
    <main style={{ background: '#111827', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <AdminNav active="/bot/admin/evaluaties" />

      <div className="admin-content" style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 40px' }}>
        <p style={{ color: '#f59e0b', fontSize: '13px', letterSpacing: '4px', marginBottom: '8px' }}>ARNOBOT ADMIN</p>
        <h1 style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-1px' }}>Feedback</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', letterSpacing: '2px', marginBottom: '48px' }}>
          {(evaluaties ?? []).length} ingevuld
        </p>

        <EvaluatiesClient
          evaluaties={evaluaties ?? []}
          totalRatings={totalRatings}
          positiveRatings={positiveRatings}
          negativeRatings={negativeRatings ?? []}
        />
      </div>
    </main>
  )
}
