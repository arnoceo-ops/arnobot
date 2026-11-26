import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verstuurMailZacht } from '@/lib/mail'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    await verstuurMailZacht({
      from: 'ArnoBot <noreply@arno.bot>',
      to: 'delete@arno.bot',
      subject: `Verwijderverzoek: ${naam}`,
      html: `<p>Gebruiker <strong>${naam}</strong> (${email}) heeft verzocht het account en alle persoonsgegevens te verwijderen.</p><p>Clerk ID: <code>${userId}</code></p><p>Te verwijderen: approved_users (anonimiseren: voornaam, achternaam, full_name, email en linkedin leeg, is_active uit), arnobot_rds_logs (optioneel), arnobot_blog_profiles, arnobot_documenten met de bestanden in de bucket arnobot-documenten (functie verwijderGebruikersDocumenten in lib/documenten.ts, of de gebruiker deed het zelf met VERWIJDER ALLES in Uploads), de profielen uit een andere AI (functie verwijderGebruikersImports in lib/historieImport.ts), arnobot_referrals (rijen laten staan: bij referred_user_id het veld referred_naam leegmaken, bij referrer_user_id het veld code_used op verwijderd zetten), arnobot_referral_grootboek (rijen laten staan, alleen persoonsgegevens uit de reden van een handmatig besluit halen en het begin "handmatig besluit: " laten staan), arnobot_referral_acties en arnobot_referral_gratis_periodes (rijen laten staan: het zijn uitgekeerde bedragen en periodes bij de betaaladministratie, met alleen interne ids; staat er in gegevens, fout of melding een naam of ander persoonsgegeven, haal dat dan uit de tekst; bestaat de kopie arnobot_referral_grootboek_meeloop_backup, behandel die als het grootboek), Clerk-gebruiker, PostHog-persoon + eventuele session recordings (PostHog: Persons zoeken op distinct ID = Clerk ID, dan Delete; of via de API).</p>`,
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error('Delete account error:', e)
    return NextResponse.json({ error: 'Verwijderverzoek mislukt' }, { status: 500 })
  }
}
