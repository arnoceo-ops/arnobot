import { client } from '@/sanity/client'
import SparClient from './SparClient'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const serviceDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getSparPage() {
  return await client.fetch(`*[_type == "sparPage"][0]`, {}, { next: { revalidate: 0 } })
}

export default async function BotPage({ searchParams }: { searchParams: Promise<{ resume?: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [profileRes, planRes] = await Promise.all([
    serviceDb.from('arnobot_blog_profiles').select('profiel').eq('user_id', userId).single(),
    serviceDb.from('approved_users').select('plan').eq('user_id', userId).single(),
  ])

  if (!profileRes.data) redirect('/bot/qa')

  const plan = (planRes.data?.plan as 'basis' | 'premium' | 'team') ?? 'premium'
  const voiceEnabled = plan !== 'basis'
  const spar = await getSparPage()
  const { resume } = await searchParams
  return (
    <SparClient
      userId={userId}
      profiel={profileRes.data.profiel}
      voiceEnabled={voiceEnabled}
      taglineTitle="Ik ben ARNOBOT: Jouw 24/7 salescoach."
      taglineSub="Gebaseerd op 40 jaar sales executie, 30 jaar bedrijven bouwen, 20 jaar blogs schrijven en 15 jaar scaling up coaching. Jouw vragen worden beantwoord uit mijn bibliotheek van 369.000 woorden."
      openers={spar?.openers ?? []}
      resumeSessionId={resume}
    />
  )
}
