import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TeamClient from './TeamClient'

const BOUWER_EMAIL = 'linkedin@royaldutchsales.com'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function TeamPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  if (email !== BOUWER_EMAIL) {
    const { data } = await supabase
      .from('approved_users')
      .select('command_manager')
      .eq('user_id', userId)
      .single()
    if (!data?.command_manager) redirect('/bot')
  }

  return <TeamClient />
}
