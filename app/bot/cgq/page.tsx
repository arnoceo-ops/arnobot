import SparClient from '../SparClient'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { isElevenLabsConfigured, isVoiceLaunchAllowed } from '@/lib/voice'

const serviceDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Losgetrokken van /bot (28 augustus 2026): het vragenraster stond eerst standaard op de
// hoofdpagina, maar bleek weinig gebruikt (circa 11% van de gesprekken start ermee, gemeten op
// gesprekstitels sinds de huidige vragenset live ging) en maakte de hoofdpagina onnodig druk.
// Route hernoemd naar /bot/cgq (29 augustus 2026, "community generated questions", korter dan
// /bot/voorbeeldvragen). Zelfde SparClient-component, alleen met mode="voorbeeldvragen" (interne
// naam, niet zichtbaar in de URL): toont vóór het eerste bericht het vragenraster in plaats van
// de hero, en gedraagt zich daarna precies als /bot zelf (ask() start het gesprek in dezelfde
// component; de adresbalk wisselt daarna stil terug naar /bot, zie SparClient.tsx).
export default async function CgqPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [profileRes, planRes] = await Promise.all([
    serviceDb.from('arnobot_blog_profiles').select('profiel').eq('user_id', userId).single(),
    serviceDb.from('approved_users').select('plan').eq('user_id', userId).single(),
  ])

  if (!profileRes.data) redirect('/bot/qa')

  const plan = (planRes.data?.plan as 'basis' | 'premium' | 'team') ?? 'premium'
  const voiceEnabled = plan !== 'basis' && isElevenLabsConfigured() && isVoiceLaunchAllowed(userId)

  return (
    <SparClient
      userId={userId}
      profiel={profileRes.data.profiel}
      voiceEnabled={voiceEnabled}
      taglineTitle="Ik ben ARNOBOT: Jouw 24/7 salescoach."
      taglineSub="Gebaseerd op 40 jaar sales executie, 30 jaar bedrijven bouwen, 20 jaar blogs schrijven en 15 jaar scaling up coaching. Jouw vragen worden beantwoord uit mijn bibliotheek van 369.000 woorden."
      mode="voorbeeldvragen"
    />
  )
}
