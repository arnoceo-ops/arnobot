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

async function proxyToClerk(req: NextRequest, path: string[]): Promise<NextResponse> {
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

  const clerkRes = await fetch(targetUrl, init)
  return new NextResponse(clerkRes.body, {
    status: clerkRes.status,
    headers: new Headers(clerkRes.headers),
  })
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
