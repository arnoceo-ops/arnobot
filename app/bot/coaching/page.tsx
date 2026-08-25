import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { logEvent } from '@/lib/events'
import CoachingClient from './CoachingClient'
import SpeCoachingClient from './SpeCoachingClient'
import BotNav from '../BotNav'
import { isConfirmedTeambaas } from '@/lib/teamAccess'
import { MANUAL_TEST_USER_ID } from '@/lib/internalTestAccounts'

// Wie de ?bekijkAls=-testswitch hieronder mag gebruiken: Arno's eigen testaccount, plus Thijs
// (thijs@tenshare.nl), tweede manager van het testteam Team Hippios. Thijs is in de praktijk
// geen teambaas, Arno's expliciete verzoek (2026-08-22) om ook voor hem tussen de MSA- en
// SPE-weergave te kunnen wisselen.
const BEKIJK_ALS_TOEGESTAAN = [MANUAL_TEST_USER_ID, 'user_3EiyfRK85W4Vx4ebqbxbTys79LC']

export default async function CoachingPage({ searchParams }: { searchParams: Promise<{ bekijkAls?: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  logEvent(userId, 'coaching_page_view')

  // Rolbewust, vóór de plan-gate hieronder: een bevestigde teambaas verkoopt zelf niet (zie
  // docs/TEAM_PLAN.md, "either/or"-besluit), krijgt dus nooit de Mindset/Systeem/Actie-versie,
  // maar zijn eigen Strategy People Execution-coaching. CEO/solopreneur vallen hier bewust nog
  // niet onder, zie TEAM_PLAN.md "TO DO, apart traject".
  let teambaas = await isConfirmedTeambaas(userId)

  // Testoverride, alleen voor BEKIJK_ALS_TOEGESTAAN hierboven: ?bekijkAls=verkoper of
  // ?bekijkAls=teambaas forceert de weergave voor testdoeleinden, zonder de echte team-signalen
  // (arnobot_team_members, command_manager, profiel.gebruik) aan te raken. Werkt nergens anders,
  // ook niet voor andere admins.
  if (BEKIJK_ALS_TOEGESTAAN.includes(userId)) {
    const { bekijkAls } = await searchParams
    if (bekijkAls === 'verkoper') teambaas = false
    else if (bekijkAls === 'teambaas') teambaas = true
  }

  if (teambaas) {
    return <SpeCoachingClient />
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('approved_users')
    .select('plan, arno_call_booked_at')
    .eq('user_id', userId)
    .single()

  if (!data || data.plan === 'basis') {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        `}</style>
        <BotNav active="coaching" />
        <div style={{ minHeight: '100vh', paddingTop: 64, background: '#111827' }}>
          <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400, fontSize: 13, letterSpacing: 4, color: '#f59e0b', marginBottom: 8 }}>ARNOBOT</p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', marginBottom: 32 }}>COACHING</h1>
            <div style={{ borderLeft: '3px solid #f59e0b', padding: '24px 28px', background: '#1f2937', marginBottom: 40 }}>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: '#9ca3af', lineHeight: 1.9 }}>
                Coaching is beschikbaar voor Pro-gebruikers. Arno analyseert al je gesprekken, je analyses uit het Archief in relatie tot jouw specifieke profiel. Hij laat je zien wat werkt en ook wat je het best kunt veranderen voor nog betere performance.
              </p>
            </div>
            <Link
              href="/bot/upgrade"
              style={{
                display: 'inline-block', padding: '12px 36px',
                background: '#f59e0b', color: '#111827',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 18, letterSpacing: 3,
                textDecoration: 'none', borderRadius: 999,
              }}
            >
              UPGRADE →
            </Link>
          </div>
        </div>
      </>
    )
  }

  // Sparren-knop alleen tonen als er de laatste 14 dagen geen sparring-sessie was, zodat wie
  // net geoefend heeft niet steeds opnieuw wordt uitgenodigd. Arno's expliciete keuze
  // (2026-08-22): tijdgebonden, niet een percentage van totale gesprekken (dat geeft ruis bij
  // weinig data).
  const veertienDagenGeleden = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recenteSparSessie } = await supabase
    .from('arnobot_sparring_sessions')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', veertienDagenGeleden)
    .limit(1)
    .maybeSingle()

  return <CoachingClient userId={userId} plan={data?.plan ?? 'basis'} gesprekBookedAt={data?.arno_call_booked_at ?? null} showSparren={!recenteSparSessie} />
}
