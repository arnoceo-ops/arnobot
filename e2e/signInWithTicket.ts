import type { Page } from '@playwright/test'

// Omweg voor clerk.signIn() uit @clerk/testing/playwright (26-9-2026): die helper, en ook een
// rechtstreekse Clerk.client.signIn.create({ strategy: 'ticket' })-aanroep, gooien "An
// unexpected response was received from the server" nadat Clerk's server de sign-in al
// correct en volledig heeft verwerkt (geverifieerd via netwerk-onderschepping: actieve sessie +
// geldig token terug, de fout komt puur uit clerk-js zelf daarna, een door Clerk automatisch
// ververst script waar wij geen controle over hebben). Ticket-in-URL-navigatie (zoals een
// magic-link) werkt hier ook niet: deze app gebruikt een zelfgebouwde inlogpagina
// (useSignIn()-hook), geen Clerk's kant-en-klare component die dat automatisch oppikt.
//
// Deze omweg doet de sign-in-REST-aanroep zelf, buiten clerk-js om, via page.request (deelt de
// cookie-jar met de browser-context). De dev-instance-cookiebrug (__clerk_db_jwt) staat al na
// de eerste paginalading (normale Clerk-middleware-handshake, werkt wel). Na de sign-in-aanroep
// een reload: dezelfde handshake die de sessieloze staat naar localhost-cookies synchroniseert,
// blijkt ook de nieuwe, actieve sessie te synchroniseren.
//
// Bij een volgende Clerk/@clerk-testing-update: eerst proberen of clerk.signIn() uit
// @clerk/testing het gewone pad weer doet, dan dit bestand kunnen verwijderen.
export async function signInWithTicket(page: Page, userId: string): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new Error('CLERK_SECRET_KEY ontbreekt (nodig voor de sign-in-ticket-omweg)')
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  if (!publishableKey) throw new Error('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ontbreekt')

  // Frontend API-host afleiden uit de publishable key (base64, vorm pk_test_<host-base64>$).
  const encodedHost = publishableKey.replace(/^pk_(test|live)_/, '').replace(/\$$/, '')
  const fapiHost = Buffer.from(encodedHost, 'base64').toString('utf8').replace(/\$$/, '')

  // Eerste paginalading: laat Next.js/Clerk-middleware de normale dev-browser-handshake doen
  // (__clerk_db_jwt, __client_uat), dat deel werkt al.
  await page.goto('/')

  const dbJwtCookie = (await page.context().cookies()).find(c => c.name === '__clerk_db_jwt')
  if (!dbJwtCookie) throw new Error('__clerk_db_jwt-cookie ontbreekt na eerste paginalading')

  // Clerk ververst clerk-js zelf op de CDN; hardcoderen zou hier bij de volgende versie
  // opnieuw stilzwijgend kunnen breken. Lees de daadwerkelijk geladen versie uit de pagina.
  const clerkJsVersion = await page.evaluate(() => (window as unknown as { Clerk?: { version?: string } }).Clerk?.version)
  if (!clerkJsVersion) throw new Error('Kon geladen clerk-js-versie niet uitlezen (window.Clerk.version)')

  const tokenRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 60 }),
  })
  if (!tokenRes.ok) throw new Error(`Sign-in token aanmaken mislukt: ${tokenRes.status} ${await tokenRes.text()}`)
  const { token } = (await tokenRes.json()) as { token: string }

  const signInRes = await page.request.post(
    `https://${fapiHost}/v1/client/sign_ins`,
    {
      params: {
        __clerk_api_version: '2026-05-12',
        _clerk_js_version: clerkJsVersion,
        __clerk_db_jwt: dbJwtCookie.value,
      },
      form: { strategy: 'ticket', ticket: token },
    }
  )
  if (!signInRes.ok()) throw new Error(`Sign-in-REST-aanroep mislukt: ${signInRes.status()} ${await signInRes.text()}`)
  const body = await signInRes.json() as { response?: { status?: string } }
  if (body.response?.status !== 'complete') throw new Error(`Sign-in niet compleet, status: ${body.response?.status}`)

  // Reload: dezelfde middleware-handshake die net de sessieloze staat synchroniseerde,
  // synchroniseert nu de zojuist aangemaakte, actieve sessie naar een __session-cookie.
  await page.reload()

  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if ((await page.context().cookies()).some(c => c.name === '__session')) return
    await page.waitForTimeout(300)
  }
  throw new Error('Sign-in via ticket: __session-cookie verscheen niet binnen 15s na reload')
}
