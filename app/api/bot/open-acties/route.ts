import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Alle nog niet beantwoorde acties, niet alleen de meest recente zoals /api/bot/actieopvolging
// (die voedt de eenmalige in-app popup bij het openen van de app). Voor het permanente
// overzicht in de Bieb, zodat een gebruiker die de popup ooit wegklikte of de e-mailherinnering
// nooit opende, zijn openstaande acties alsnog kan terugvinden.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ acties: [] })

  const { data } = await supabase
    .from('arnobot_blog_sessions')
    .select('session_id, uitdaging, created_at')
    .eq('user_id', userId)
    .not('uitdaging', 'is', null)
    .is('actie_status', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ acties: data ?? [] })
}
