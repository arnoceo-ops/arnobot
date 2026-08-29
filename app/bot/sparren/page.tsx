import SparClient from '../SparClient'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { isElevenLabsConfigured } from '@/lib/voice'

const serviceDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function SparrenPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Een bevestigde teambaas kan ook sparren (blokkade weggehaald 2026-08-29): een sales
  // manager voert wel degelijk lastige gesprekken, met een underperformer, zijn eigen CEO of
  // een boze grote klant, en de sparring-personacategorie "salesbaas" is daar precies voor
  // gebouwd. rolCategorie valt in SparClient.tsx vanzelf terug op "salesbaas" bij een
  // manager-profiel dat geen van de vaste rollijsten matcht.

  const [profileRes, planRes] = await Promise.all([
    serviceDb.from('arnobot_blog_profiles').select('profiel').eq('user_id', userId).single(),
    serviceDb.from('approved_users').select('plan').eq('user_id', userId).single(),
  ])

  if (!profileRes.data) redirect('/bot/qa')

  const plan = (planRes.data?.plan as 'basis' | 'premium' | 'team') ?? 'premium'
  const voiceEnabled = plan !== 'basis' && isElevenLabsConfigured()

  return (
    <SparClient
      userId={userId}
      profiel={profileRes.data.profiel}
      voiceEnabled={voiceEnabled}
      taglineTitle="Ik ben ARNOBOT: Jouw 24/7 salescoach."
      taglineSub="Gebaseerd op 40 jaar sales executie, 30 jaar bedrijven bouwen, 20 jaar blogs schrijven en 15 jaar scaling up coaching. Jouw vragen worden beantwoord uit mijn bibliotheek van 369.000 woorden."
      mode="sparren"
      plan={plan}
    />
  )
}
