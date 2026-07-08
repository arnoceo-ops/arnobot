import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({
      convsSinceLastAnalysis: 0,
      daysSinceLastAnalysis: null,
      analysesSinceLastCoaching: 0,
      daysSinceLastCoaching: null,
      convsSinceLastCoaching: 0,
    })
  }

  const [lastAnalysisRes, lastCoachingRes] = await Promise.all([
    supabase
      .from('arnobot_analyses')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('arnobot_coaching')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const lastAnalysisDate = lastAnalysisRes.data?.created_at ?? null
  const lastCoachingDate = lastCoachingRes.data?.created_at ?? null
  const now = new Date()

  const daysSinceLastAnalysis = lastAnalysisDate
    ? Math.floor((now.getTime() - new Date(lastAnalysisDate).getTime()) / 86400000)
    : null
  const daysSinceLastCoaching = lastCoachingDate
    ? Math.floor((now.getTime() - new Date(lastCoachingDate).getTime()) / 86400000)
    : null

  const sinceAnalysis = lastAnalysisDate ?? '1970-01-01T00:00:00Z'
  const sinceCoaching = lastCoachingDate ?? '1970-01-01T00:00:00Z'

  const [convsAnalysisRes, analysesCoachingRes, convsCoachingRes] = await Promise.all([
    supabase
      .from('arnobot_blog_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gt('created_at', sinceAnalysis),
    supabase
      .from('arnobot_analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', sinceCoaching),
    supabase
      .from('arnobot_blog_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gt('created_at', sinceCoaching),
  ])

  return NextResponse.json({
    convsSinceLastAnalysis: convsAnalysisRes.count ?? 0,
    daysSinceLastAnalysis,
    analysesSinceLastCoaching: analysesCoachingRes.count ?? 0,
    daysSinceLastCoaching,
    convsSinceLastCoaching: convsCoachingRes.count ?? 0,
  })
}
