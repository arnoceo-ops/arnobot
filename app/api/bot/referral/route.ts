import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isValidEmail, emailHtml } from '@/lib/email-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

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

  const { data: user } = await supabase
    .from('approved_users')
    .select('referral_code, referral_credit, voornaam, full_name')
    .eq('user_id', userId)
    .maybeSingle()

  if (!user) return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })

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

  const [{ count }, { count: converted }] = await Promise.all([
    supabase.from('arnobot_referrals').select('*', { count: 'exact', head: true }).eq('referrer_user_id', userId),
    supabase.from('arnobot_referrals').select('*', { count: 'exact', head: true }).eq('referrer_user_id', userId).eq('status', 'converted'),
  ])

  return NextResponse.json({
    code,
    link: `https://arno.bot/aanmelden?ref=${code}`,
    referrals: count ?? 0,
    converted: converted ?? 0,
    credit: user.referral_credit ?? 0,
  })
}

// POST — verwerk referral code van nieuwe gebruiker na inloggen
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Geen code' }, { status: 400 })

  // Zoek referrer
  const { data: referrer } = await supabase
    .from('approved_users')
    .select('user_id, voornaam, full_name, email')
    .eq('referral_code', code.toUpperCase())
    .maybeSingle()

  if (!referrer) return NextResponse.json({ error: 'Onbekende code' }, { status: 404 })
  if (referrer.user_id === userId) return NextResponse.json({ error: 'Eigen code' }, { status: 400 })

  // Check niet al eerder gebruikt
  const { data: existing } = await supabase
    .from('arnobot_referrals')
    .select('id')
    .eq('referred_user_id', userId)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, already: true })

  // Haal nieuwe gebruiker info op
  const clerk = await clerkClient()
  let newUserName = 'iemand'
  try {
    const cu = await clerk.users.getUser(userId)
    newUserName = [cu.firstName, cu.lastName].filter(Boolean).join(' ') || 'iemand'
  } catch {}

  await supabase.from('arnobot_referrals').insert({
    referrer_user_id: referrer.user_id,
    referred_user_id: userId,
    code_used: code.toUpperCase(),
    status: 'signed_up',
  })

  // Telegram-melding naar Arno, zelfde bot/groep als de nieuwe-gebruiker-melding in proxy.ts.
  // Ontbrak hier: een referral-code die pas na het inloggen wordt verwerkt (via SparClient.tsx,
  // niet de aanmeld-cookie in proxy.ts) gaf tot nu toe alleen een mail aan de referrer, Arno
  // zag deze aanmeldingen dus nergens (bevestigd 2026-08-25).
  const tgToken = process.env.TELEGRAM_BOT_TOKEN
  const tgChat = process.env.TELEGRAM_CHAT_ID
  if (tgToken && tgChat) {
    const tgSafe = (s: string) => s.replace(/[\r\n\t]/g, ' ').slice(0, 100)
    const referrerLabel = referrer.voornaam || (referrer.full_name ?? '').split(' ')[0] || referrer.email || 'onbekend'
    const tgText = `Nieuwe referral-aanmelding\n\nNaam: ${tgSafe(newUserName)}\nReferral: ${tgSafe(code.toUpperCase())}\nReferrer: ${tgSafe(referrerLabel)}`
    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text: tgText }),
    }).catch(() => {})
  }

  // Email naar referrer
  const referrerNaam = referrer.voornaam || (referrer.full_name ?? '').split(' ')[0] || 'Hey'
  if (isValidEmail(referrer.email)) {
    const body = `<strong style="color:#f1f5f9;">${newUserName}</strong> heeft zich zojuist aangemeld via jouw referral code <strong style="color:#f59e0b;">${code.toUpperCase()}</strong>.<br><br>Kiest ${newUserName} voor Pro of Team, dan ontvang jij tegoed zodra het abonnement is afgesloten, maximaal je eigen maandprijs. Bij Basic ontvang je geen tegoed. Bij een maandabonnement na drie voltooide betaalmaanden. Bij een jaarabonnement direct na de eerste betaling.`
    await resend.emails.send({
      from: 'ArnoBot <noreply@arno.bot>',
      to: referrer.email,
      subject: `${newUserName} heeft zich aangemeld via jouw referral code`,
      html: emailHtml(body, 'MIJN REFERRALS →', 'https://arno.bot/bot/account', false, undefined, referrerNaam),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
