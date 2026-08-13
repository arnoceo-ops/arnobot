import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import BotNav from '../BotNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function GesprekPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [userRes, coachingRes, memberRes, profileRes] = await Promise.all([
    supabase
      .from('approved_users')
      .select('email, voornaam, achternaam, arno_call_booked_at, plan, paid_at')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('arnobot_coaching')
      .select('mindset_score, systeem_score, actie_score')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('arnobot_team_members')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('arnobot_blog_profiles')
      .select('profiel')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const data = userRes.data
  const heeftCoachingDocument = coachingRes.data?.mindset_score != null
    && coachingRes.data?.systeem_score != null
    && coachingRes.data?.actie_score != null
  const gebruik = (profileRes.data?.profiel as { gebruik?: string } | null)?.gebruik ?? null
  const isTeamMember = !!memberRes.data && memberRes.data.role !== 'manager' && gebruik !== 'individueel'
  const magBoeken = data?.plan === 'premium' && !!data?.paid_at && heeftCoachingDocument && !isTeamMember

  if (!magBoeken && !data?.arno_call_booked_at) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
        `}</style>
        <BotNav active="account" />
        <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>
          <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT</p>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', marginBottom: 32 }}>
            GESPREK MET ARNO
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.9, color: '#9ca3af' }}>
            Dit gesprek is voor betalende Pro-gebruikers, zodra er een coachingdocument is. Ga naar je coachingpagina om te zien waar je staat.
          </p>
        </div>
      </>
    )
  }

  const bookingUrl = process.env.ARNO_BOOKING_URL

  let bookingLink: string | null = null
  if (bookingUrl) {
    const url = new URL(bookingUrl)
    if (data?.email) url.searchParams.set('email', data.email)
    const naam = [data?.voornaam, data?.achternaam].filter(Boolean).join(' ')
    if (naam) url.searchParams.set('name', naam)
    // Onveranderlijke koppeling voor de webhook (zie app/api/webhooks/calendly/route.ts):
    // komt terug in payload.tracking.utm_content, ongeacht wat iemand in het Calendly-
    // formulier zelf invult.
    url.searchParams.set('utm_content', userId)
    bookingLink = url.toString()
  } else {
    console.error('[bot/gesprek] ARNO_BOOKING_URL ontbreekt')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #f1f5f9; font-family: 'Space Mono', monospace; font-weight: 400; }
      `}</style>

      <BotNav active="account" />

      <div style={{ maxWidth: 812, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,4vw,20px) 80px' }}>
        <p style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 4, marginBottom: 8 }}>ARNOBOT</p>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 3, lineHeight: 1, color: '#f1f5f9', marginBottom: 32 }}>
          GESPREK MET ARNO
        </h1>

        {data?.arno_call_booked_at ? (
          <p style={{ fontSize: 15, lineHeight: 1.9, color: '#9ca3af' }}>
            Je hebt je persoonlijke gesprek met Arno al ingepland op {new Date(data.arno_call_booked_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
        ) : !bookingLink ? (
          <p style={{ fontSize: 15, lineHeight: 1.9, color: '#9ca3af' }}>
            Het inplannen is tijdelijk niet beschikbaar. Mail naar <a href="mailto:arno@arno.bot" style={{ color: '#f59e0b' }}>arno@arno.bot</a> om je gesprek te regelen.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 15, lineHeight: 1.9, color: '#9ca3af', marginBottom: 32 }}>
              Elke gebruiker krijgt één persoonlijk gesprek met Arno zelf. Plan hieronder een moment dat jou uitkomt, je opent daarvoor Calendly in een nieuw tabblad.
            </p>
            <a
              href={bookingLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '12px 36px',
                background: '#f59e0b', color: '#111827',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 18, letterSpacing: 3,
                textDecoration: 'none', borderRadius: 999,
              }}
            >
              PLAN JE GESPREK →
            </a>
          </>
        )}
      </div>
    </>
  )
}
