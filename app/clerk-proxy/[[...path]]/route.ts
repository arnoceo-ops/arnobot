import { NextRequest, NextResponse } from 'next/server'

function getClerkFrontendApiUrl(): string {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  const base64 = key.replace(/^pk_(live|test)_/, '')
  try {
    const decoded = Buffer.from(base64, 'base64').toString().replace(/\$*$/, '')
    return `https://${decoded}`
  } catch {
    return ''
  }
}

const FRONTEND_API = getClerkFrontendApiUrl()

// Rewrite Set-Cookie headers: remove Domain (defaults to arno.bot) and replace
// SameSite=None with SameSite=Lax so cookies are accepted as first-party.
function rewriteSetCookies(fromRes: Response, toRes: NextResponse): void {
  try {
    const getSetCookie = (fromRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
    const cookies = getSetCookie ? getSetCookie.call(fromRes.headers) : []
    for (const c of cookies) {
      const rewritten = c
        .replace(/;\s*Domain=[^;,]*/gi, '')
        .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
      toRes.headers.append('Set-Cookie', rewritten)
    }
  } catch {
    // getSetCookie not available in this runtime — skip rewriting
  }
}

async function proxyToClerk(req: NextRequest, path: string[]): Promise<NextResponse> {
  if (!FRONTEND_API) {
    return new NextResponse('Clerk proxy misconfigured', { status: 500 })
  }

  const pathStr = path.join('/')
  const targetUrl = `${FRONTEND_API}/${pathStr}${req.nextUrl.search}`

  const reqHeaders = new Headers(req.headers)
  reqHeaders.set('x-forwarded-host', req.nextUrl.host)
  reqHeaders.delete('host')

  const init: RequestInit & { duplex?: string } = { method: req.method, headers: reqHeaders }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body
    init.duplex = 'half'
  }

  try {
    const clerkRes = await fetch(targetUrl, init)

    const resHeaders = new Headers()
    clerkRes.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') resHeaders.set(key, value)
    })

    const res = new NextResponse(clerkRes.body, { status: clerkRes.status, headers: resHeaders })
    rewriteSetCookies(clerkRes, res)
    return res
  } catch (err) {
    console.error('[clerk-proxy] fetch failed:', err)
    return new NextResponse(JSON.stringify({ error: 'proxy_failed', detail: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params
  return proxyToClerk(req, path)
}
export async function POST(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params
  return proxyToClerk(req, path)
}
export async function PUT(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params
  return proxyToClerk(req, path)
}
export async function PATCH(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params
  return proxyToClerk(req, path)
}
export async function DELETE(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params
  return proxyToClerk(req, path)
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
