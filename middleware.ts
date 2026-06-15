import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const isPublicRoute = createRouteMatcher([
  '/canvas-aanmelden(.*)',
  '/api/canvas/aanmelden(.*)',
  '/bot-aanmelden(.*)',
  '/aanmelden(.*)',
  '/evaluatie(.*)',
  '/api/evaluatie(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

const isProtectedBot = createRouteMatcher(['/bot', '/bot/:path*'])

export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname

  if (!isPublicRoute(req) && path.startsWith('/canvas')) {
    await auth.protect()
  }

  if (isProtectedBot(req)) {
    await auth.protect()
    const { userId } = await auth()
    if (!userId) return NextResponse.next()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let { data: user } = await supabase
      .from('approved_users')
      .select('is_active, paid_at, expires_at, trial_start, welcome_seen, onboarding_done')
      .eq('user_id', userId)
      .single()

    // Pending gebruiker: eerste keer inloggen na trial aanmelding
    if (!user) {
      try {
        const client = await clerkClient()
        const clerkUser = await client.users.getUser(userId)
        const email = clerkUser.emailAddresses[0]?.emailAddress
        if (email) {
          const { data: pending } = await supabase
            .from('approved_users')
            .select('is_active, paid_at, expires_at, trial_start, welcome_seen, onboarding_done')
            .eq('email', email)
            .like('user_id', 'pending_%')
            .single()

          if (pending) {
            const { error: updateErr } = await supabase
              .from('approved_users')
              .update({
                user_id: userId,
                voornaam: clerkUser.firstName || undefined,
                achternaam: clerkUser.lastName || undefined,
              })
              .eq('email', email)
            if (updateErr) {
              console.error('Pending user update failed:', updateErr.message)
              return NextResponse.redirect(new URL('/bot-aanmelden', req.url))
            }
            user = pending
          } else {
            // Nieuwe gebruiker via LinkedIn OAuth — automatisch trial starten
            const linkedinAccount = clerkUser.externalAccounts?.find(
              (a: { provider: string }) => a.provider.includes('linkedin')
            )
            const linkedinUrl = (linkedinAccount as { username?: string | null } | undefined)?.username
              ? `https://www.linkedin.com/in/${(linkedinAccount as { username: string }).username}`
              : null
            const newRow = {
              user_id: userId,
              email: email || null,
              voornaam: clerkUser.firstName || null,
              achternaam: clerkUser.lastName || null,
              linkedin: linkedinUrl,
              trial_start: new Date().toISOString(),
              is_active: true,
            }
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
            const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
            const firstName = (clerkUser.firstName || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)
            const referralCode = firstName ? `${firstName}-${suffix}` : suffix

            const { error: insertErr } = await supabase.from('approved_users').insert({ ...newRow, referral_code: referralCode })
            if (insertErr) {
              console.error('New user insert failed:', insertErr.message)
              return NextResponse.redirect(new URL('/bot-aanmelden', req.url))
            }
            user = { is_active: true, paid_at: null, expires_at: null, trial_start: newRow.trial_start, welcome_seen: false, onboarding_done: false }
            // Telegram notificatie — fire and forget
            const tgToken = process.env.TELEGRAM_BOT_TOKEN
            const tgChat = process.env.TELEGRAM_NEW_USER_CHAT_ID
            if (tgToken && tgChat) {
              const tgText = `Nieuwe ArnoBot gebruiker\n\nNaam: ${clerkUser.firstName || ''} ${clerkUser.lastName || ''}\nEmail: ${email}\nLinkedIn: ${linkedinUrl || 'onbekend'}`
              fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: tgChat, text: tgText }),
              }).catch(() => {})
            }
            // Welkomstmail — fire and forget
            const resend = new Resend(process.env.RESEND_API_KEY)
            const voornaam = clerkUser.firstName || 'daar'
            resend.emails.send({
              from: 'ArnoBot <info@arno.bot>',
              to: email,
              subject: 'Je ArnoBot trial staat klaar',
              html: `
                <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#f1f5f9;background:#111827;">
                  <div style="padding:24px 32px;border-bottom:3px solid #f59e0b;">
                    <span style="font-family:'Courier New',monospace;font-size:18px;letter-spacing:4px;color:#f59e0b;">
                      ARNOBOT <span style="color:#fff;">UNLIMITED</span>
                    </span>
                  </div>
                  <div style="padding:32px;">
                    <h1 style="font-size:32px;margin-bottom:8px;color:#f1f5f9;font-family:'Courier New',monospace;letter-spacing:2px;">
                      Welkom, ${voornaam}.
                    </h1>
                    <p style="font-size:15px;color:#9ca3af;line-height:1.8;margin-bottom:24px;">
                      Je account is aangemaakt via LinkedIn.<br />
                      Je hebt <strong style="color:#f59e0b;">30 dagen gratis toegang</strong> tot ArnoBot Unlimited — geen creditcard, geen verplichtingen.
                    </p>
                    <div style="background:#1f2937;padding:20px 24px;margin-bottom:24px;border-left:3px solid #f59e0b;">
                      <p style="font-size:12px;letter-spacing:2px;color:#f59e0b;margin-bottom:4px;text-transform:uppercase;">Jouw trial</p>
                      <p style="font-size:16px;font-weight:600;color:#f1f5f9;margin:0;">30 dagen gratis, geen automatische afschrijving</p>
                      <p style="font-size:13px;color:#666;margin:4px 0 0;">Na je trial geef je zelf per e-mail aan of je doorgaat.</p>
                    </div>
                    <a href="https://arno.bot/bot"
                       style="display:inline-block;background:#f59e0b;color:#111827;font-family:'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:3px;padding:16px 40px;text-decoration:none;border-radius:999px;">
                      OPEN ARNOBOT →
                    </a>
                  </div>
                </div>
              `,
            }).catch(() => {})
          }
        }
      } catch (e) {
        console.error('Pending user lookup failed:', e)
      }
    }

    if (!user || user.is_active === false) {
      return NextResponse.redirect(new URL('/bot-aanmelden', req.url))
    }

    let toegestaan = false
    if (user.paid_at) {
      toegestaan = true
    } else if (user.expires_at) {
      const exp = new Date(user.expires_at)
      if (!isNaN(exp.getTime()) && exp > new Date()) toegestaan = true
    } else if (user.trial_start) {
      const trialStart = new Date(user.trial_start)
      const trialEnd = new Date(trialStart.getTime() + 30 * 24 * 60 * 60 * 1000)
      if (new Date() < trialEnd) toegestaan = true
    }

    if (!toegestaan) {
      return NextResponse.redirect(new URL('/bot-aanmelden', req.url))
    }

    const welcome_seen = (user as any).welcome_seen as boolean | null
    const onboarding_done = (user as any).onboarding_done as boolean | null

    if (!welcome_seen) {
      if (path !== '/bot/welkom') return NextResponse.redirect(new URL('/bot/welkom', req.url))
    } else if (!onboarding_done) {
      if (path !== '/bot/profiel') return NextResponse.redirect(new URL('/bot/profiel', req.url))
    }
  }
})

export const config = {
  matcher: ['/((?!_next|.*\\.|api/cron|bot/admin).*)'],
}
