import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { logEvent } from '@/lib/events'
import QAClient from './QAClient'

const serviceDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function QAPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  logEvent(userId, 'qa_page_view')

  const { data: profileRow } = await serviceDb
    .from('arnobot_blog_profiles')
    .select('profiel')
    .eq('user_id', userId)
    .single()

  return <QAClient isOnboarding={!profileRow} />
}
