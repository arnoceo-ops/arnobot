import SparClient from './SparClient'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { isElevenLabsConfigured, isVoiceLaunchAllowed } from '@/lib/voice'
import { coachingIsActueel } from '@/lib/coachingActueel'
import { corrigeerBouwsteen, computeFallbackGroeibalans, getGroeibalansCopy, adviesIsKortGenoeg, GROEIBALANS_KLEUREN, GroeibalansState, GroeibalansBouwsteen } from '@/lib/groeibalans'
import { telGebruik } from '@/lib/gebruikTellers'
import { isConfirmedTeambaas } from '@/lib/teamAccess'
import { bepaalSpeKaart, type SpeKaart } from '@/lib/speKaart'
import { bepaalOngelezenKaart } from '@/lib/ongelezenKaart'

const serviceDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Voornaam voor de persoonlijke begroeting in de hero. Eerst het losse voornaam-veld, anders
// het eerste woord van full_name. Geen van beide, dan null: de begroeting valt dan terug op
// een naamloze variant in plaats van "Hey, .".
function firstNameOf(voornaam: string | null | undefined, fullName: string | null | undefined): string | null {
  const vn = voornaam?.trim()
  if (vn) return vn
  const first = fullName?.trim().split(/\s+/)[0]
  return first || null
}

export default async function BotPage({ searchParams }: { searchParams: Promise<{ resume?: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [profileRes, userRes, tellers, teambaas] = await Promise.all([
    serviceDb.from('arnobot_blog_profiles').select('profiel').eq('user_id', userId).single(),
    serviceDb.from('approved_users').select('plan, voornaam, full_name, groeibalans_tonen, groeibalans_state, groeibalans_bouwsteen, groeibalans_advies, groeibalans_scenario').eq('user_id', userId).single(),
    telGebruik(serviceDb, userId),
    isConfirmedTeambaas(userId),
  ])

  if (!profileRes.data) redirect('/bot/profiel')

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
  // ontwerpgeschiedenis. `tellers` komt uit lib/gebruikTellers.ts, dat verwijderde en
  // community-uitgesloten gesprekken al wegfiltert (zelfde filters als de Bieb).
  let groeibalans: { state: GroeibalansState; bouwsteen: GroeibalansBouwsteen; tekst: string; knop: string; href: string; kleur: typeof GROEIBALANS_KLEUREN[GroeibalansState]; tellers: typeof tellers; spe?: SpeKaart; ongelezen?: { label: string; regel: string } } | null = null
  if (tellers.gesprekken >= 5) {
    const classificatieRuw = userRes.data?.groeibalans_tonen === null || userRes.data?.groeibalans_tonen === undefined
      ? computeFallbackGroeibalans(tellers)
      : userRes.data.groeibalans_tonen
        ? { tonen: true as const, state: userRes.data.groeibalans_state as GroeibalansState, bouwsteen: userRes.data.groeibalans_bouwsteen as GroeibalansBouwsteen }
        : { tonen: false as const }
    // Vaste correctie: analyses en coaching gaan vóór sparren als die nog niet gebruikt zijn (lib/groeibalans.ts)
    const classificatie = corrigeerBouwsteen(classificatieRuw, tellers)
    const bouwsteenGewijzigd = classificatieRuw.tonen && classificatie.tonen && classificatieRuw.bouwsteen !== classificatie.bouwsteen
    if (classificatie.tonen) {
      const copy = getGroeibalansCopy(classificatie.state, classificatie.bouwsteen, plan)
      // Persoonlijk advies uit de eigen historie (lib/groeibalansServer.ts) gaat voor de vaste tekst. Het
      // voorgestelde sparscenario zet persona en weerstand alvast klaar op /bot/sparren; de waarden
      // worden daar opnieuw gevalideerd tegen de rol van de gebruiker.
      // Een eerder opgeslagen, te lang advies (van voor de verkorting) valt terug op de korte vaste tekst
      // tot het bij het volgende gesprek opnieuw en korter wordt gegenereerd.
      const adviesRuw = typeof userRes.data?.groeibalans_advies === 'string' ? userRes.data.groeibalans_advies.trim() : ''
      const advies = !bouwsteenGewijzigd && adviesIsKortGenoeg(adviesRuw) ? adviesRuw : null
      const scenario = userRes.data?.groeibalans_scenario as { persona?: string; weerstand?: string } | null
      const metScenario = classificatie.bouwsteen === 'sparsessies' && scenario?.persona && scenario?.weerstand
        ? `/bot/sparren?persona=${encodeURIComponent(scenario.persona)}&weerstand=${encodeURIComponent(scenario.weerstand)}` : null
      // COACH ME start de generatie op de coachingspagina direct (?start=1), zodat de gebruiker daar
      // niet nog eens hoeft te klikken. Alleen voor de coaching-knop zelf, niet voor UPGRADE.
      const metStart = classificatie.bouwsteen === 'coaching' && copy.href === '/bot/coaching' ? '/bot/coaching?start=1' : null
      groeibalans = { state: classificatie.state, bouwsteen: classificatie.bouwsteen, ...copy, ...(advies ? { tekst: advies } : {}), ...(metScenario ? { href: metScenario } : {}), ...(metStart ? { href: metStart } : {}), kleur: GROEIBALANS_KLEUREN[classificatie.state], tellers }
    }
    // Harde controle: nooit coaching aanbevelen als het advies al actueel is. De AI-classificatie
    // kent die stand niet (alleen tellers en geschiedenis), de coachingspagina wel.
    if (groeibalans?.bouwsteen === 'coaching' && teambaas) {
      // Een bevestigde teambaas krijgt op /bot/coaching de SPE-pagina (eigen tabel, eigen regels),
      // niet de Mindset/Systeem/Actie-coaching waar deze kaart op meet. De kaart zou COACH ME
      // aanbieden zonder dat de knop iets genereert (gevonden 2026-11-19). Als de SPE-analyse
      // mogelijk is, komt de LEIDERSCHAP-kaart hieronder in de plaats.
      groeibalans = null
    } else if (groeibalans?.bouwsteen === 'coaching') {
      const [coachingRes, sessieRes, analyseRes] = await Promise.all([
        serviceDb.from('arnobot_coaching').select('updated_at').eq('user_id', userId).maybeSingle(),
        serviceDb.from('arnobot_blog_sessions').select('created_at').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        serviceDb.from('arnobot_analyses').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (coachingIsActueel((coachingRes.data as { updated_at?: string } | null)?.updated_at, sessieRes.data?.created_at, analyseRes.data?.created_at)) {
        groeibalans = null
      }
    }
  }

  // LEIDERSCHAP-kaart voor een bevestigde teambaas (lib/speKaart.ts): zodra de SPE-analyse volgens
  // dezelfde regel als de server mogelijk is, gaat die voor elke andere kaart, ook zonder 5
  // eigen gesprekken (de kaart meet 1:1's, niet gesprekken met ArnoBot). Frequentie blijft de
  // bestaande groeiNudge-regel (één keer per login, maximaal twee keer per apparaat).
  if (teambaas) {
    const spe = await bepaalSpeKaart(serviceDb, userId)
    if (spe) {
      groeibalans = { state: 'groeikans', bouwsteen: 'coaching', tekst: spe.tekst, knop: spe.knop, href: spe.href, kleur: GROEIBALANS_KLEUREN.groeikans, tellers, spe }
    }
  }

  // NIEUW-kaart (lib/ongelezenKaart.ts): een coaching of analyse die klaarstaat maar nog niet is
  // geopend, bijvoorbeeld omdat de gebruiker wegging terwijl er werd geschreven. Gaat voor elke
  // andere kaart en valt buiten de grens van twee vertoningen (zie groeiNudgeMagTonen): hij blijft
  // elke login terugkomen tot het document is geopend.
  const ongelezen = await bepaalOngelezenKaart(serviceDb, userId, teambaas)
  if (ongelezen) {
    groeibalans = { state: 'groeikans', bouwsteen: 'coaching', tekst: ongelezen.tekst, knop: ongelezen.knop, href: ongelezen.href, kleur: GROEIBALANS_KLEUREN.groeikans, tellers, ongelezen: { label: ongelezen.label, regel: ongelezen.regel } }
  }

  return (
    <SparClient
      userId={userId}
      profiel={profileRes.data.profiel}
      voiceEnabled={voiceEnabled}
      taglineTitle="Ik ben ARNOBOT: Jouw 24/7 salescoach."
      taglineSub="Gebaseerd op 44 jaar saleservaring, 35 jaar ondernemerschap en 17 jaar business coaching. Jouw vragen worden beantwoord uit mijn bibliotheek van 369.000 woorden."
      resumeSessionId={resume}
      voornaam={firstNameOf(userRes.data?.voornaam as string | null | undefined, userRes.data?.full_name as string | null | undefined)}
      groeibalans={groeibalans}
      plan={plan}
    />
  )
}
