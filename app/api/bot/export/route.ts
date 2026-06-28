import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  try {
    const [profile, logs, account, coaching, referrals, teamlidmaatschap, sessieanalyses] = await Promise.all([
      supabaseAdmin.from('arnobot_blog_profiles').select('*').eq('user_id', userId),
      supabaseAdmin.from('arnobot_rds_logs').select('*').eq('user_id', userId),
      supabaseAdmin.from('approved_users').select('*').eq('user_id', userId),
      supabaseAdmin.from('arnobot_coaching').select('*').eq('user_id', userId),
      supabaseAdmin.from('arnobot_referrals').select('*').or(`referrer_user_id.eq.${userId},referred_user_id.eq.${userId}`),
      supabaseAdmin.from('arnobot_team_members').select('*').eq('user_id', userId),
      supabaseAdmin.from('arnobot_blog_sessions').select('id, title, summary, created_at').eq('user_id', userId),
    ])

    return NextResponse.json({
      export_datum: new Date().toISOString(),
      gebruiker: { clerk_id: userId },
      account: account.data ?? [],
      profiel: profile.data ?? [],
      gesprekken: logs.data ?? [],
      coaching: coaching.data ?? [],
      referrals: referrals.data ?? [],
      team: teamlidmaatschap.data ?? [],
      sessie_analyses: sessieanalyses.data ?? [],
    })
  } catch (e: unknown) {
    console.error('Export error:', e)
    return NextResponse.json({ error: 'Export mislukt' }, { status: 500 })
  }
}
