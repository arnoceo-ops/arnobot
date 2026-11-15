import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Alle routes die een AI- of spraakdienst aanroepen (stem-chat, sparren, coaching, analyses, teamfuncties, spraak naar tekst,
// voorlezen, verfijnen, dagelijkse gedachte) hebben dezelfde toegangspoort als de gewone chat: een gebruiker zonder toegang
// (verlopen proef, geblokkeerd team) krijgt een 403 en er gaat niets naar een model of spraakdienst. De gewone chatroute
// heeft zijn eigen test. Een nieuwe route die geld kost hoort hier bij.

const { auth, toegang, create, stream, fetchSpy } = vi.hoisted(() => ({
  auth: vi.fn(), toegang: vi.fn(), create: vi.fn(), stream: vi.fn(), fetchSpy: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth }))
vi.mock('@/lib/toegangNu', () => ({ heeftToegangNu: toegang }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create, stream }; constructor() {} },
  Anthropic: class { messages = { create, stream }; constructor() {} },
}))
vi.stubGlobal('fetch', fetchSpy)

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'
process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:1'
process.env.UPSTASH_REDIS_REST_TOKEN = 'x'
process.env.ANTHROPIC_API_KEY = 'x'
process.env.OPENAI_API_KEY = 'x'
process.env.ELEVENLABS_API_KEY = 'x'

type Handler = (r: NextRequest) => Promise<Response>
type Route = { naam: string; module: Record<string, unknown>; methoden: ('GET' | 'POST')[]; ongeautoriseerd: number }

const routes: Route[] = [
  { naam: 'stem-chat', module: await import('./chat-voice/route'), methoden: ['POST'], ongeautoriseerd: 401 },
  { naam: 'sparren starten', module: await import('./sparring/open/route'), methoden: ['POST'], ongeautoriseerd: 401 },
  { naam: 'sparren chat', module: await import('./sparring/chat/route'), methoden: ['POST'], ongeautoriseerd: 401 },
  { naam: 'sparren afronden', module: await import('./sparring/debrief/route'), methoden: ['POST'], ongeautoriseerd: 401 },
  { naam: 'coaching analyse', module: await import('./bot/coaching-analyse/route'), methoden: ['POST'], ongeautoriseerd: 401 },
  { naam: 'coaching precheck', module: await import('./bot/coaching-precheck/route'), methoden: ['GET'], ongeautoriseerd: 401 },
  { naam: 'coaching', module: await import('./bot/coaching/route'), methoden: ['GET', 'POST'], ongeautoriseerd: 401 },
  { naam: 'team 1:1', module: await import('./bot/team/1on1/route'), methoden: ['POST'], ongeautoriseerd: 401 },
  { naam: 'team spotlight', module: await import('./bot/team/spotlight/route'), methoden: ['GET', 'POST'], ongeautoriseerd: 401 },
  { naam: 'team zelfcoaching', module: await import('./bot/team/zelfcoaching/route'), methoden: ['GET', 'POST'], ongeautoriseerd: 401 },
  { naam: 'dagelijkse gedachte', module: await import('./bot/uitdaging/route'), methoden: ['GET'], ongeautoriseerd: 401 },
  { naam: 'verfijn', module: await import('./bot/verfijn/route'), methoden: ['POST'], ongeautoriseerd: 401 },
  { naam: 'spraak naar tekst', module: await import('./transcribe/route'), methoden: ['POST'], ongeautoriseerd: 401 },
  { naam: 'spraak naar tekst live', module: await import('./transcribe/live/route'), methoden: ['POST'], ongeautoriseerd: 401 },
  { naam: 'voorlezen', module: await import('./tts-voice/route'), methoden: ['GET'], ongeautoriseerd: 401 },
]

const aanroep = (handler: Handler, methode: 'GET' | 'POST') =>
  handler(new NextRequest('https://www.arno.bot/api/x?q=hallo', methode === 'POST'
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }
    : { method: 'GET' }))

beforeEach(() => {
  auth.mockReset(); toegang.mockReset(); create.mockReset(); stream.mockReset(); fetchSpy.mockReset()
  auth.mockResolvedValue({ userId: 'u1' })
})

describe.each(routes.flatMap(r => r.methoden.map(m => [`${r.naam} (${m})`, r, m] as const)))('%s', (_naam, route, methode) => {
  it('weigert een gebruiker zonder toegang met 403 geen_toegang en roept geen model of spraakdienst aan', async () => {
    toegang.mockResolvedValue(false)
    const res = await aanroep(route.module[methode] as Handler, methode)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('geen_toegang')
    expect(toegang).toHaveBeenCalledWith('u1')
    expect(create).not.toHaveBeenCalled()
    expect(stream).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('geeft een niet-ingelogde aanvrager een 401 zonder de toegang op te zoeken', async () => {
    auth.mockResolvedValue({ userId: null })
    const res = await aanroep(route.module[methode] as Handler, methode)
    expect(res.status).toBe(route.ongeautoriseerd)
    expect(toegang).not.toHaveBeenCalled()
  })
})

describe('zoeken in eigen gesprekken', () => {
  it('geeft zonder toegang een lege lijst, zoals bij niet ingelogd, en roept geen model aan', async () => {
    const { GET } = await import('./bot/sessions/search/route')
    toegang.mockResolvedValue(false)
    const res = await GET(new NextRequest('https://www.arno.bot/api/bot/sessions/search?q=prijs', { method: 'GET' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sessions: [] })
    expect(toegang).toHaveBeenCalledWith('u1')
    expect(create).not.toHaveBeenCalled()
  })
})
