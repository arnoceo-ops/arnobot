import SparClient from './SparClient'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { isElevenLabsConfigured, isVoiceLaunchAllowed } from '@/lib/voice'
import { computeFallbackGroeibalans, getGroeibalansCopy, GROEIBALANS_KLEUREN, GroeibalansState, GroeibalansBouwsteen } from '@/lib/groeibalans'

const serviceDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function BotPage({ searchParams }: { searchParams: Promise<{ resume?: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [profileRes, userRes, gesprekkenCountRes, sparCountRes, analysesCountRes, coachingCountRes] = await Promise.all([
    serviceDb.from('arnobot_blog_profiles').select('profiel').eq('user_id', userId).single(),
    serviceDb.from('approved_users').select('plan, voornaam, groeibalans_tonen, groeibalans_state, groeibalans_bouwsteen').eq('user_id', userId).single(),
    serviceDb.from('arnobot_blog_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    serviceDb.from('arnobot_sparring_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    serviceDb.from('arnobot_analyses').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    serviceDb.from('arnobot_coaching').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  if (!profileRes.data) redirect('/bot/qa')

  const plan = (userRes.data?.plan as 'basis' | 'premium' | 'team') ?? 'premium'
  // isElevenLabsConfigured() als extra schakelaar: ELEVENLABS_API_KEY tijdelijk weghalen in
  // Vercel verbergt de voice-knop meteen én voorkomt kosten, zonder losse feature-flag.
  // isVoiceLaunchAllowed() = tijdelijke launch-restrictie (zie lib/voice.ts), niet verwarren
  // met de plan-check hiervoor.
  const voiceEnabled = plan !== 'basis' && isElevenLabsConfigured() && isVoiceLaunchAllowed(userId)
  const { resume } = await searchParams

  // Gebruiksbalans-kader (desktop-only, zie SparClient.tsx): drempel van 5 gesprekken totaal,
  // dan de AI-classificatie leidend (approved_users.groeibalans_*), en zolang die nog niet is
  // ingevuld (gebruiker nog geen sessie gehad ná het bouwen van deze functie) de tellings-
  // fallback uit lib/groeibalans.ts. Zie project_gebruiksbalans_concept.md voor de volledige
  // ontwerpgeschiedenis.
  const tellers = {
    gesprekken: gesprekkenCountRes.count ?? 0,
    sparsessies: sparCountRes.count ?? 0,
    analyses: analysesCountRes.count ?? 0,
    coaching: coachingCountRes.count ?? 0,
  }
  let groeibalans: { state: GroeibalansState; bouwsteen: GroeibalansBouwsteen; tekst: string; knop: string; href: string; kleur: typeof GROEIBALANS_KLEUREN[GroeibalansState]; tellers: typeof tellers } | null = null
  if (tellers.gesprekken >= 5) {
    const classificatie = userRes.data?.groeibalans_tonen === null || userRes.data?.groeibalans_tonen === undefined
      ? computeFallbackGroeibalans(tellers)
      : userRes.data.groeibalans_tonen
        ? { tonen: true as const, state: userRes.data.groeibalans_state as GroeibalansState, bouwsteen: userRes.data.groeibalans_bouwsteen as GroeibalansBouwsteen }
        : { tonen: false as const }
    if (classificatie.tonen) {
      const copy = getGroeibalansCopy(classificatie.state, classificatie.bouwsteen, plan)
      groeibalans = { state: classificatie.state, bouwsteen: classificatie.bouwsteen, ...copy, kleur: GROEIBALANS_KLEUREN[classificatie.state], tellers }
    }
  }

  return (
    <SparClient
      userId={userId}
      profiel={profileRes.data.profiel}
      voiceEnabled={voiceEnabled}
      taglineTitle="Ik ben ARNOBOT: Jouw 24/7 salescoach."
      taglineSub="Gebaseerd op 40 jaar sales executie, 30 jaar bedrijven bouwen, 20 jaar blogs schrijven en 15 jaar scaling up coaching. Jouw vragen worden beantwoord uit mijn bibliotheek van 369.000 woorden."
      resumeSessionId={resume}
      voornaam={(userRes.data?.voornaam as string | null) ?? null}
      groeibalans={groeibalans}
    />
  )
}
