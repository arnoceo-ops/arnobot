import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// De toegangscontrole van de chatroute: een gebruiker zonder toegang (verlopen proef, geblokkeerd team) krijgt een 403 en
// de route start niets wat geld kost (geen RAG, geen modelaanroep). Alleen deze poort wordt hier getest; de rest van de
// route heeft geen routetest.

const { auth, toegang, create, stream } = vi.hoisted(() => ({
  auth: vi.fn(),
  toegang: vi.fn(),
  create: vi.fn(),
  stream: vi.fn(),
}))

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

const { POST } = await import('./route')

const aanroep = () => POST(new NextRequest('https://www.arno.bot/api/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://www.arno.bot' },
  body: JSON.stringify({ question: 'Hoe pak ik een koude prospect aan?', history: [] }),
}))

beforeEach(() => {
  auth.mockReset(); toegang.mockReset(); create.mockReset(); stream.mockReset()
  auth.mockResolvedValue({ userId: 'u1' })
})

describe('/api/chat toegangscontrole', () => {
  it('weigert een gebruiker zonder toegang met 403 geen_toegang en roept het model nooit aan', async () => {
    toegang.mockResolvedValue(false)
    const res = await aanroep()
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('geen_toegang')
    expect(toegang).toHaveBeenCalledWith('u1')
    expect(create).not.toHaveBeenCalled()
    expect(stream).not.toHaveBeenCalled()
  })

  it('geeft een niet-ingelogde aanvrager een 401 zonder de toegang op te zoeken (de goedkope poort eerst)', async () => {
    auth.mockResolvedValue({ userId: null })
    const res = await aanroep()
    expect(res.status).toBe(401)
    expect(toegang).not.toHaveBeenCalled()
  })

  it('laat de eigenaar zonder toegangscontrole door (hij loopt niet via datums)', async () => {
    process.env.ARNOBOT_OWNER_USER_ID = 'eigenaar'
    auth.mockResolvedValue({ userId: 'eigenaar' })
    toegang.mockResolvedValue(false)
    await aanroep().catch(() => {})
    expect(toegang).not.toHaveBeenCalled()
    delete process.env.ARNOBOT_OWNER_USER_ID
  })
})
