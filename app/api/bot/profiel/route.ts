import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const serviceDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { profiel } = await req.json()
  if (!profiel) return NextResponse.json({ error: 'Geen profiel meegestuurd' }, { status: 400 })

  const { error } = await serviceDb
    .from('arnobot_blog_profiles')
    .upsert(
      { user_id: userId, profiel, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('Profiel opslaan:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  // De 30-dagen trial-klok wordt heraankerd op het moment dat de onboarding echt af is,
  // niet op het moment van accountaanmaak. Zo kost aarzelen over de intake geen trialdagen.
  // Alleen bij de allereerste keer (onboarding_done nog niet gezet) en alleen voor een
  // echte trial (nog niet betaald); een latere profielaanpassing raakt trial_start nooit.
  const { data: huidig } = await serviceDb
    .from('approved_users')
    .select('onboarding_done, paid_at')
    .eq('user_id', userId)
    .maybeSingle()

  const onboardingUpdate: Record<string, unknown> = { onboarding_done: true }
  if (!huidig?.onboarding_done && !huidig?.paid_at) {
    onboardingUpdate.trial_start = new Date().toISOString()
  }

  const { error: onboardingError } = await serviceDb
    .from('approved_users')
    .update(onboardingUpdate)
    .eq('user_id', userId)

  if (onboardingError) {
    console.error('onboarding_done update:', onboardingError)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  // Lead-signaal: iemand die via een gewone trial binnenkomt en bij de intake aangeeft
  // ArnoBot voor zijn team te willen (geen bestaand Team-account, want dan is command_manager
  // gezet en verschijnt deze vraag niet). Eenmalig bij het afronden van de onboarding, één
  // mail naar de inbox, geen tabel of CRM. Zie docs/SALES_BIJBEL.md "Aanlooproutes".
  if (!huidig?.onboarding_done && profiel.gebruik === 'team') {
    try {
      const clerk = await clerkClient()
      const user = await clerk.users.getUser(userId)
      const email = user.emailAddresses[0]?.emailAddress ?? 'onbekend'
      const naam = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'onbekend'
      await resend.emails.send({
        from: 'ArnoBot <info@arno.bot>',
        to: 'waitlist@arno.bot',
        subject: 'Team-lead vanuit de trial-onboarding',
        text: `Iemand gaf bij de profiel-intake aan ArnoBot voor zijn team te willen:\n\nNaam: ${naam}\nE-mail: ${email}\nRol: ${profiel.rol ?? 'onbekend'}\nTeamgrootte: ${profiel.teamgrootte ?? 'onbekend'}`,
      })
    } catch (e) {
      console.error('team-lead mail:', e)
    }
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await serviceDb
    .from('arnobot_blog_profiles')
    .select('profiel')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Profiel ophalen:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  // Een uitgenodigd teamlid ('member', in tegenstelling tot de manager zelf, die als
  // 'manager' geregistreerd staat) hoort geen managementrollen te kunnen kiezen: die horen
  // bij wie een team aanmaakt, niet bij wie er één binnenkomt via een uitnodigingslink.
  const { data: teamMember } = await serviceDb
    .from('arnobot_team_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  // command_manager wordt al bij trial-aanmaak gezet (proxy.ts, via sales development), dus
  // staat meestal al vóór de eerste profiel-invulling vast. Deze persoon is per definitie het
  // Team-segment (Sales Director/VP of Sales), nooit verkoper, CEO/DGA of solopreneur.
  const { data: approved } = await serviceDb
    .from('approved_users')
    .select('command_manager')
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json({
    profiel: data?.profiel || null,
    isTeamMember: teamMember?.role === 'member',
    isCommandManager: approved?.command_manager === true,
  })
}
