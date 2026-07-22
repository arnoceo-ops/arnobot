import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function buildCSP(nonce: string, allowWasm = false): string {
  // Een pk_test_-sleutel betekent altijd de Clerk development-instance (bijv. lokaal
  // draaien tegen Playwright E2E-tests), pk_live_ altijd productie. script-src staat
  // clerk.arno.bot (productie) hardcoded toe; connect-src stond *.accounts.dev al toe
  // maar script-src niet, waardoor Clerk's eigen script op de development-instance
  // stilletjes geblokkeerd werd en inloggen nooit kon voltooien.
  const isDevInstance = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') ?? false
  const clerkScriptSrc = isDevInstance ? 'https://*.accounts.dev' : 'https://clerk.arno.bot'
  // Clerk's development-instance gebruikt een dev-browser handshake (JWT-verificatie via
  // redirects) die 'unsafe-eval' vereist. Productie (pk_live_) heeft dit nooit nodig, dus
  // dit verzwakt de CSP van de live app niet.
  const clerkUnsafeEval = isDevInstance ? " 'unsafe-eval'" : ''
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${allowWasm ? " 'wasm-unsafe-eval'" : ''}${clerkUnsafeEval} ${clerkScriptSrc} https://challenges.cloudflare.com https://assets.feedblitz.com https://app.feedblitz.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://assets.feedblitz.com",
    "font-src 'self' https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "img-src 'self' data: blob: https://images.squarespace-cdn.com https://cdn.sanity.io https://img.clerk.com https://assets.feedblitz.com",
    "connect-src 'self' https://clerk.arno.bot wss://clerk.arno.bot https://*.clerk.com https://*.accounts.dev wss://*.clerk.com https://app.feedblitz.com https://arnobot.instatus.com",
    "frame-src https://clerk.arno.bot https://*.clerk.com https://*.accounts.dev https://challenges.cloudflare.com https://www.loom.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://clerk.arno.bot https://*.clerk.com https://*.accounts.dev https://app.feedblitz.com",
    "report-uri /api/csp-report",
  ].join('; ')
}

const isProtectedBot = createRouteMatcher(['/bot', '/bot/:path*'])
const isAdminRoute = createRouteMatcher(['/bot/admin', '/bot/admin/:path*'])

const SCANNER_PATTERNS = /^\/(\.env|\.git|\.svn|wp-admin|wp-login\.php|phpMyAdmin|phpmyadmin|admin\.php|xmlrpc\.php|shell\.php|eval-stdin\.php|config\.php|setup\.php|install\.php|backup|\.DS_Store|\.htaccess|\.htpasswd|web\.config|etc\/passwd|proc\/self)(\/|$)/i

export default clerkMiddleware(async (auth, req) => {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const csp = buildCSP(nonce, isAdminRoute(req))

  function nextWithNonce(): NextResponse {
    const reqHeaders = new Headers(req.headers)
    reqHeaders.set('x-nonce', nonce)
    const res = NextResponse.next({ request: { headers: reqHeaders } })
    res.headers.set('Content-Security-Policy', csp)
    res.headers.set('x-nonce', nonce)
    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('X-Frame-Options', 'DENY')
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()')
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    return res
  }

  const path = req.nextUrl.pathname

  if (SCANNER_PATTERNS.test(path)) {
    return new NextResponse(null, { status: 404 })
  }

  // Admin routes: cookie-auth wordt per pagina afgehandeld.
  if (isAdminRoute(req)) {
    return nextWithNonce()
  }

  // Uitzondering op isProtectedBot hieronder: deze pagina moet je juist kunnen zien
  // zonder dat de auto-trial-aanmaak hieronder alsnog voor je een account opent.
  if (path === '/bot/uitnodiging-vereist') {
    return nextWithNonce()
  }

  if (isProtectedBot(req)) {
    await auth.protect()
    const { userId } = await auth()
    if (!userId) return nextWithNonce()

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
            // Enterprise-domeingebonden teams: geen zelfbediening-trial voor deze
            // domeinen, alleen toegang via de uitnodigingslink van de manager
            // (/bot/team/join?code=...). Voorkomt dat iedereen met dat bedrijfsdomein
            // zelf een account aanmaakt zodra enterprise SSO voor dat domein aanstaat.
            const emailDomain = email.split('@')[1]?.toLowerCase()
            if (emailDomain) {
              const { data: gatedTeam } = await supabase
                .from('arnobot_teams')
                .select('invite_code')
                .ilike('domain', emailDomain)
                .maybeSingle()

              if (gatedTeam) {
                const joinCode = req.nextUrl.searchParams.get('code')
                const hasValidInvite = path === '/bot/team/join' && joinCode === gatedTeam.invite_code
                if (!hasValidInvite) {
                  return NextResponse.redirect(new URL('/bot/uitnodiging-vereist', req.url))
                }
              }
            }

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
              // Trial-gebruikers krijgen volledige functionaliteit (coaching, voice, hoge
              // limieten), niet het basis-plan. Wie na de trial voor het goedkopere basis-
              // abonnement kiest, verliest die functionaliteit dan bewust. Expliciet gezet
              // i.p.v. te leunen op de kolom-default, die stond hier eerder foutief op 'basis'.
              plan: 'premium',
            }
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
            const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
            const firstName = (clerkUser.firstName || '').toUpperCase().replace(/[^A-Z]/g, '')
            const referralCode = firstName ? `${firstName}-${suffix}` : suffix

            const { error: insertErr } = await supabase.from('approved_users').upsert(
              { ...newRow, referral_code: referralCode },
              { onConflict: 'user_id', ignoreDuplicates: true }
            )
            if (insertErr) {
              console.error('New user insert failed:', insertErr.message)
              return NextResponse.redirect(new URL('/bot-aanmelden', req.url))
            }
            user = { is_active: true, paid_at: null, expires_at: null, trial_start: newRow.trial_start, welcome_seen: false, onboarding_done: false }
            // Referral cookie verwerken
            const refCode = req.cookies.get('arnobot_ref')?.value?.toUpperCase()
            if (refCode && /^[A-Z0-9-]{4,20}$/.test(refCode)) {
              const { data: referrer } = await supabase
                .from('approved_users')
                .select('user_id, voornaam, full_name, email')
                .eq('referral_code', refCode)
                .maybeSingle()
              if (referrer && referrer.user_id !== userId) {
                const { data: existingRef } = await supabase
                  .from('arnobot_referrals')
                  .select('id')
                  .eq('referred_user_id', userId)
                  .maybeSingle()
                if (!existingRef) {
                  const newUserName2 = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'iemand'
                  await supabase.from('arnobot_referrals').insert({
                    referrer_user_id: referrer.user_id,
                    referred_user_id: userId,
                    referred_naam: newUserName2,
                    code_used: refCode,
                    status: 'signed_up',
                  })
                }
              }
            }
            // Telegram notificatie — bewust awaited: fire-and-forget wordt op Edge Runtime afgekapt
            const tgToken = process.env.TELEGRAM_NEW_USER_BOT_TOKEN
            const tgChat = process.env.TELEGRAM_NEW_USER_CHAT_ID
            if (tgToken && tgChat) {
              const refCodeForTg = req.cookies.get('arnobot_ref')?.value?.toUpperCase()
              const tgSafe = (s: string) => s.replace(/[\r\n\t]/g, ' ').slice(0, 100)
              const tgText = `Nieuwe ArnoBot gebruiker\n\nNaam: ${tgSafe(clerkUser.firstName || '')} ${tgSafe(clerkUser.lastName || '')}\nEmail: ${tgSafe(email || '')}\nLinkedIn: ${tgSafe(linkedinUrl || 'onbekend')}${refCodeForTg ? `\nReferral: ${tgSafe(refCodeForTg)}` : ''}`
              await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: tgChat, text: tgText }),
              }).catch(() => {})
            }
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

  return nextWithNonce()
})

export const config = {
  matcher: ['/((?!_next|.*\\.|api/cron|clerk-proxy).*)'],
}
