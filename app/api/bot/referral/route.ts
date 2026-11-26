import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isGewoonTeamlid } from '@/lib/teamAccess'
import { isGratisAccount } from '@/lib/gratisAccount'
import { referralCijfers } from '@/lib/billing/referralCijfers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateCode(firstName: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const name = firstName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)
  return name ? `${name}-${suffix}` : suffix
}

// GET — haal eigen referral code op (genereer als nog niet bestaat)
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Server-side vangnet naast de client-side verborgen ReferralSection (verborgen voor
  // gewone teamleden): die hebben geen eigen abonnement. Managers mogen wel referren.
  if (await isGewoonTeamlid(userId)) {
    return NextResponse.json({ error: 'Referralprogramma is niet beschikbaar voor teamleden' }, { status: 400 })
  }

  const { data: user } = await supabase
    .from('approved_users')
    // Alle kolommen: isGratisAccount heeft ook lifetime_sinds nodig.
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!user) return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
  if (isGratisAccount(user)) return NextResponse.json({ error: 'Referralprogramma is niet beschikbaar voor dit account' }, { status: 400 })

  let code = user.referral_code
  if (!code) {
    const firstName = user.voornaam || (user.full_name ?? '').split(' ')[0] || 'USER'
    code = generateCode(firstName)
    // Zorg dat de code uniek is
    let attempt = 0
    while (attempt < 5) {
      const { data: existing } = await supabase
        .from('approved_users')
        .select('user_id')
        .eq('referral_code', code)
        .maybeSingle()
      if (!existing) break
      code = generateCode(firstName)
      attempt++
    }
    await supabase.from('approved_users').update({ referral_code: code }).eq('user_id', userId)
  }

  const [{ count, error: telFout }, cijfers] = await Promise.all([
    supabase.from('arnobot_referrals').select('*', { count: 'exact', head: true }).eq('referrer_user_id', userId),
    referralCijfers(userId),
  ])

  return NextResponse.json({
    code,
    link: `https://arno.bot/aanmelden?ref=${code}`,
    // null: tellen mislukt. Liever geen teller dan een nul die niet klopt.
    referrals: telFout ? null : count ?? 0,
    betalend: cijfers.betalend,
    tegoedCent: cijfers.tegoedCent,
  })
}
