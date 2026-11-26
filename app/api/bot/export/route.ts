import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { leesProfielen } from '@/lib/historieImport'
import { exporteerGrootboek, exporteerReferralActies, eigenReferralGegevens } from '@/lib/billing/referralExport'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  try {
    const [profile, logs, account, coaching, referrals, teamlidmaatschap, sessieanalyses, documenten, profielenAndereAi, referraltegoed, referraluitkeringen] = await Promise.all([
      supabaseAdmin.from('arnobot_blog_profiles').select('*').eq('user_id', userId),
      supabaseAdmin.from('arnobot_rds_logs').select('*').eq('user_id', userId),
      supabaseAdmin.from('approved_users').select('*').eq('user_id', userId),
      supabaseAdmin.from('arnobot_coaching').select('*').eq('user_id', userId),
      supabaseAdmin.from('arnobot_referrals').select('*').or(`referrer_user_id.eq.${userId},referred_user_id.eq.${userId}`),
      supabaseAdmin.from('arnobot_team_members').select('*').eq('user_id', userId),
      supabaseAdmin.from('arnobot_blog_sessions').select('id, title, summary, created_at').eq('user_id', userId),
      // Alleen de gegevens over de documenten (naam, soort, grootte, datum, bewaard of tijdelijk), niet de inhoud: de
      // bestanden zelf haalt de gebruiker met DOWNLOAD uit de tab Docs. Grafstenen (al verwijderd) horen er niet in.
      supabaseAdmin.from('arnobot_documenten')
        .select('naam, soort, media_type, bytes, bewaard, created_at, laatst_gebruikt, verloopt_op, samenvatting')
        .eq('user_id', userId)
        .is('verwijderd_op', null)
        .limit(1000),
      // De profielen die de gebruiker zelf uit een andere AI heeft overgenomen (alleen via lib/historieImport.ts, de tabel mag nergens anders gelezen worden).
      leesProfielen(supabaseAdmin, userId),
      exporteerGrootboek(supabaseAdmin, userId),
      exporteerReferralActies(supabaseAdmin, userId),
    ])

    return NextResponse.json({
      export_datum: new Date().toISOString(),
      gebruiker: { clerk_id: userId },
      account: account.data ?? [],
      profiel: profile.data ?? [],
      gesprekken: logs.data ?? [],
      coaching: coaching.data ?? [],
      referrals: eigenReferralGegevens(referrals.data ?? [], userId),
      referraltegoed,
      referraluitkeringen,
      team: teamlidmaatschap.data ?? [],
      sessie_analyses: sessieanalyses.data ?? [],
      documenten: documenten.data ?? [],
      profielen_uit_andere_ai: profielenAndereAi,
    })
  } catch (e: unknown) {
    console.error('Export error:', e)
    return NextResponse.json({ error: 'Export mislukt' }, { status: 500 })
  }
}
