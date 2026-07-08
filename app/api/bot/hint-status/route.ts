import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ convCount: 0, analysisCount: 0, coachingCount: 0 })

  const [convRes, analysisRes, coachingRes] = await Promise.all([
    supabase.from('arnobot_blog_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null),
    supabase.from('arnobot_analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase.from('arnobot_coaching')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  return NextResponse.json({
    convCount: convRes.count ?? 0,
    analysisCount: analysisRes.count ?? 0,
    coachingCount: coachingRes.count ?? 0,
  })
}
