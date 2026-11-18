import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// De import-routes: toegang (inloggen, schakelaar, toegangspoort), de lengtecontrole vóór limiter en model, de limiet, en dat het opslaan en
// verwijderen alleen de eigen rij raakt.

const { auth, toegang, limiet, zetOm, bewaar, lees, verwijder, intern } = vi.hoisted(() => ({
  auth: vi.fn(), toegang: vi.fn(), limiet: vi.fn(), zetOm: vi.fn(), bewaar: vi.fn(), lees: vi.fn(), verwijder: vi.fn(), intern: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/toegangsPoort', () => ({ toegangsWeigering: toegang }))
vi.mock('@/lib/limietVeilig', () => ({ limietVeilig: limiet }))
vi.mock('@/lib/internalTestAccounts', () => ({ isInternalTestUser: intern }))
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: class { static slidingWindow() { return {} } } }))
vi.mock('@upstash/redis', () => ({ Redis: class {} }))
vi.mock('@anthropic-ai/sdk', () => ({ default: class {} }))
vi.mock('@/lib/historieImport', () => ({ zetOmInProfiel: zetOm, bewaarProfiel: bewaar, leesProfiel: lees, verwijderProfiel: verwijder }))

const omzetten = await import('./omzetten/route')
const profiel = await import('./profiel/route')

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('https://www.arno.bot/api/bot/import/omzetten', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers })
const put = (body: unknown) =>
  new NextRequest('https://www.arno.bot/api/bot/import/profiel', { method: 'PUT', body: JSON.stringify(body) })

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv('ARNOBOT_OWNER_USER_ID', 'user_eigenaar')
  vi.stubEnv('HISTORIE_IMPORT_OPEN', '')
  auth.mockReset(); toegang.mockReset(); limiet.mockReset(); zetOm.mockReset(); bewaar.mockReset(); lees.mockReset(); verwijder.mockReset(); intern.mockReset()
  auth.mockResolvedValue({ userId: 'user_eigenaar' })
  toegang.mockResolvedValue(null)
  limiet.mockResolvedValue({ success: true })
  intern.mockReturnValue(false)
  zetOm.mockResolvedValue({ fout: null, profiel: { bedrijf: ['x'], klanten: [], plannen: [], uitdagingen: [] }, leeg: false })
  bewaar.mockResolvedValue({ error: null })
  lees.mockResolvedValue(null)
  verwijder.mockResolvedValue({ error: false })
})

describe('toegang tot alle import-routes', () => {
  it('geeft 401 zonder inlog', async () => {
    auth.mockResolvedValue({ userId: null })
    expect((await omzetten.POST(post({ tekst: 'a' }))).status).toBe(401)
    expect((await profiel.GET()).status).toBe(401)
    expect((await profiel.DELETE()).status).toBe(401)
  })
  it('geeft 404 voor een gewone gebruiker zolang de schakelaar dicht is, ook voor verwijderen', async () => {
    auth.mockResolvedValue({ userId: 'user_gewoon' })
    expect((await omzetten.POST(post({ tekst: 'a' }))).status).toBe(404)
    expect((await profiel.GET()).status).toBe(404)
    expect((await profiel.PUT(put({ bron: 'claude', profiel: {} }))).status).toBe(404)
    expect((await profiel.DELETE()).status).toBe(404)
    expect(zetOm).not.toHaveBeenCalled()
    expect(bewaar).not.toHaveBeenCalled()
    expect(verwijder).not.toHaveBeenCalled()
  })
  it('is open voor iedereen na de schakelaar', async () => {
    vi.stubEnv('HISTORIE_IMPORT_OPEN', 'true')
    auth.mockResolvedValue({ userId: 'user_gewoon' })
    expect((await profiel.GET()).status).toBe(200)
  })
  it('weigert omzetten en opslaan zonder toegang, maar laat verwijderen en lezen toe', async () => {
    toegang.mockResolvedValue(NextResponse.json({ error: 'geen_toegang' }, { status: 403 }))
    expect((await omzetten.POST(post({ tekst: 'a' }))).status).toBe(403)
    expect((await profiel.PUT(put({ bron: 'claude', profiel: { bedrijf: ['x'] } }))).status).toBe(403)
    expect((await profiel.DELETE()).status).toBe(200)
    expect((await profiel.GET()).status).toBe(200)
  })
})

describe('omzetten', () => {
  it('geeft het voorstel terug en bewaart niets', async () => {
    const r = await omzetten.POST(post({ tekst: 'Mijn antwoord' }))
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ leeg: false, profiel: { bedrijf: ['x'] } })
    expect(bewaar).not.toHaveBeenCalled()
  })
  it('controleert de lengte vóór de limiter en vóór het model', async () => {
    const r = await omzetten.POST(post({ tekst: 'x'.repeat(20001) }))
    expect(r.status).toBe(400)
    expect(limiet).not.toHaveBeenCalled()
    expect(zetOm).not.toHaveBeenCalled()
  })
  it('leest een buitensporig grote body niet eens', async () => {
    const r = await omzetten.POST(post({ tekst: 'a' }, { 'content-length': '5000000' }))
    expect(r.status).toBe(413)
    expect(zetOm).not.toHaveBeenCalled()
  })
  it('weigert een lege of verkeerde invoer', async () => {
    expect((await omzetten.POST(post({ tekst: '   ' }))).status).toBe(400)
    expect((await omzetten.POST(post({ tekst: 5 }))).status).toBe(400)
    expect((await omzetten.POST(post('geen json'))).status).toBe(400)
    expect(zetOm).not.toHaveBeenCalled()
  })
  it('geeft 429 bij een overschreden limiet, maar slaat interne testaccounts over', async () => {
    limiet.mockResolvedValue({ success: false })
    expect((await omzetten.POST(post({ tekst: 'a' }))).status).toBe(429)
    expect(zetOm).not.toHaveBeenCalled()
    intern.mockReturnValue(true)
    expect((await omzetten.POST(post({ tekst: 'a' }))).status).toBe(200)
  })
  it('vertaalt een fout van de omzetting naar een status', async () => {
    zetOm.mockResolvedValue({ fout: 'omzetten_mislukt' })
    expect((await omzetten.POST(post({ tekst: 'a' }))).status).toBe(502)
    zetOm.mockResolvedValue({ fout: 'invoer_leeg' })
    expect((await omzetten.POST(post({ tekst: 'a' }))).status).toBe(400)
  })
})

describe('profiel', () => {
  it('slaat een profiel op onder de eigen gebruiker en met een geldige bron', async () => {
    const r = await profiel.PUT(put({ bron: 'chatgpt', profiel: { bedrijf: ['Verkoopt software'] } }))
    expect(r.status).toBe(200)
    expect(bewaar.mock.calls[0][1]).toBe('user_eigenaar')
    expect(bewaar.mock.calls[0][2]).toBe('chatgpt')
  })
  it('weigert een onbekende bron of een kapotte body zonder iets op te slaan', async () => {
    expect((await profiel.PUT(put({ bron: 'gemini', profiel: {} }))).status).toBe(400)
    expect((await profiel.PUT(put({ profiel: {} }))).status).toBe(400)
    expect((await profiel.PUT(new NextRequest('https://www.arno.bot/api/bot/import/profiel', { method: 'PUT', body: 'kapot' }))).status).toBe(400)
    expect(bewaar).not.toHaveBeenCalled()
  })
  it('vertaalt validatiefouten van het opslaan en een databasefout', async () => {
    bewaar.mockResolvedValue({ error: 'leeg' })
    expect((await profiel.PUT(put({ bron: 'claude', profiel: {} }))).status).toBe(400)
    bewaar.mockResolvedValue({ error: 'opslaan_mislukt' })
    expect((await profiel.PUT(put({ bron: 'claude', profiel: { bedrijf: ['x'] } }))).status).toBe(500)
  })
  it('leest en verwijdert alleen het profiel van de ingelogde gebruiker', async () => {
    lees.mockResolvedValue({ bron: 'claude', profiel: { bedrijf: ['x'] }, created_at: '2026-11-18T10:00:00.000Z' })
    const g = await profiel.GET()
    expect((await g.json()).profiel.bron).toBe('claude')
    expect(lees.mock.calls[0][1]).toBe('user_eigenaar')
    await profiel.DELETE()
    expect(verwijder.mock.calls[0][1]).toBe('user_eigenaar')
  })
  it('meldt een mislukte verwijdering', async () => {
    verwijder.mockResolvedValue({ error: true })
    expect((await profiel.DELETE()).status).toBe(500)
  })
})
