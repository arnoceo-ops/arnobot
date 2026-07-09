export async function POST(request: Request) {
  const body = await request.text()

  try {
    const { dsn } = JSON.parse(body.split('\n')[0])
    const dsnUrl = new URL(dsn)
    const projectId = dsnUrl.pathname.replace('/', '')
    const upstreamUrl = `https://${dsnUrl.hostname}/api/${projectId}/envelope/`

    const res = await fetch(upstreamUrl, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
    })

    return new Response(null, { status: res.status })
  } catch {
    return new Response('invalid envelope', { status: 400 })
  }
}
