import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  try {
    const { data: user } = await supabaseAdmin
      .from('approved_users')
      .select('voornaam, achternaam, email')
      .eq('user_id', userId)
      .maybeSingle()

    const naam = [user?.voornaam, user?.achternaam].filter(Boolean).join(' ') || 'Onbekend'
    const email = user?.email || 'Onbekend'

    await resend.emails.send({
      from: 'ArnoBot <noreply@arno.bot>',
      to: 'delete@arno.bot',
      subject: `Verwijderverzoek: ${naam}`,
      html: `<p>Gebruiker <strong>${naam}</strong> (${email}) heeft verzocht het account en alle persoonsgegevens te verwijderen.</p><p>Clerk ID: <code>${userId}</code></p><p>Te verwijderen: approved_users (anonimiseren), arnobot_rds_logs (optioneel), arnobot_blog_profiles, Clerk-gebruiker, PostHog-persoon + eventuele session recordings (PostHog: Persons zoeken op distinct ID = Clerk ID, dan Delete; of via de API).</p>`,
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error('Delete account error:', e)
    return NextResponse.json({ error: 'Verwijderverzoek mislukt' }, { status: 500 })
  }
}
