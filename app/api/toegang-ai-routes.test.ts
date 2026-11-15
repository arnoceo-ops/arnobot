import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// De stem-chat en de drie sparroutes kosten net als de gewone chat geld. Een gebruiker zonder toegang (verlopen proef,
// geblokkeerd team) krijgt een 403 en er wordt geen model aangeroepen. De gewone chatroute heeft zijn eigen test.

const { auth, toegang, create, stream } = vi.hoisted(() => ({ auth: vi.fn(), toegang: vi.fn(), create: vi.fn(), stream: vi.fn() }))

vi.mock('@clerk/nextjs/server', () => ({ auth }))
vi.mock('@/lib/toegangNu', () => ({ heeftToegangNu: toegang }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create, stream }; constructor() {} },
  Anthropic: class { messages = { create, stream }; constructor() {} },
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'
process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:1'
process.env.UPSTASH_REDIS_REST_TOKEN = 'x'
process.env.ANTHROPIC_API_KEY = 'x'

const routes = {
  'stem-chat': await import('./chat-voice/route'),
  'sparren starten': await import('./sparring/open/route'),
  'sparren chat': await import('./sparring/chat/route'),
  'sparren afronden': await import('./sparring/debrief/route'),
}

const aanroep = (POST: (r: NextRequest) => Promise<Response>) =>
  POST(new NextRequest('https://www.arno.bot/api/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))

beforeEach(() => {
  auth.mockReset(); toegang.mockReset(); create.mockReset(); stream.mockReset()
  auth.mockResolvedValue({ userId: 'u1' })
})

describe.each(Object.entries(routes))('%s', (_naam, route) => {
  it('weigert een gebruiker zonder toegang met 403 geen_toegang en roept geen model aan', async () => {
    toegang.mockResolvedValue(false)
    const res = await aanroep(route.POST as never)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('geen_toegang')
    expect(toegang).toHaveBeenCalledWith('u1')
    expect(create).not.toHaveBeenCalled()
    expect(stream).not.toHaveBeenCalled()
  })

  it('geeft een niet-ingelogde aanvrager een 401 zonder de toegang op te zoeken', async () => {
    auth.mockResolvedValue({ userId: null })
    const res = await aanroep(route.POST as never)
    expect(res.status).toBe(401)
    expect(toegang).not.toHaveBeenCalled()
  })
})
