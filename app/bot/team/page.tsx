import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TeamClient from './TeamClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bewust géén hardgecodeerde bouwer-uitzondering meer (Arno's eigen LinkedIn-account kon
// deze pagina altijd zien, ongeacht command_manager, verwijderd 2026-08-24 op zijn
// verzoek): zijn account gedraagt zich nu identiek aan elk ander account.
export default async function TeamPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data } = await supabase
    .from('approved_users')
    .select('command_manager')
    .eq('user_id', userId)
    .single()
  if (!data?.command_manager) redirect('/bot')

  return <TeamClient />
}
