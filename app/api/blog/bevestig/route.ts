import { NextRequest, NextResponse } from 'next/server'
import { isUserInitiatedNavigation } from '@/lib/blogConfirmGate'
import { clientIp, tokenIpLimit } from '@/lib/blogRateLimit'
import { SITE_URL, confirmSubscription, isTokenShape } from '@/lib/blogSubscribers'

// Doel van de link in de bevestigingsmail. Een klik van een mens bevestigt direct en stuurt door
// naar /blog; alles wat er niet uitziet als een echte klik (mailscanners) wordt doorgestuurd naar
// de pagina met een bevestigknop, zonder iets te wijzigen. Zie lib/blogConfirmGate.ts.
function redirectTo(path: string) {
  const res = NextResponse.redirect(new URL(path, SITE_URL), 303)
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('Referrer-Policy', 'no-referrer')
  return res
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? ''
  if (!isTokenShape(token)) return redirectTo('/blog?bevestigd=0')

  if (!isUserInitiatedNavigation(req.headers)) return redirectTo(`/blog/bevestig/${token}`)

  const { success } = await tokenIpLimit.limit(clientIp(req))
  if (!success) return redirectTo(`/blog/bevestig/${token}`)

  try {
    const result = await confirmSubscription(token)
    return redirectTo(result === 'ok' ? '/blog?bevestigd=1' : '/blog?bevestigd=0')
  } catch (err) {
    console.error('[blog/bevestig]', err instanceof Error ? err.message : err)
    return redirectTo(`/blog/bevestig/${token}`)
  }
}
