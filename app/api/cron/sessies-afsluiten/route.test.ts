import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Bewijst de hele cronroute zonder echte database of model: selectie via de SQL-functie, test-accounts
// overslaan, aanroep van session-end met het CRON_SECRET, mislukkingen tellen en pas na 3 keer melden.

const { mockRpc, mockFrom, mockNotify, state } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockNotify: vi.fn(),
  state: {
    logs: [] as { question: string; answer: string }[],
    sessie: null as { community_excluded: boolean } | null,
    metaRijen: [] as { key: string; value: string }[],
    upserts: [] as { key: string; value: string }[][],
  },
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mockRpc, from: mockFrom }) }))
vi.mock('@/lib/cron-notify', () => ({ notifyCronFailure: mockNotify }))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
process.env.CRON_SECRET = 'geheim'

function bouwer(tabel: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'order']) b[m] = () => b
  b.maybeSingle = async () => ({ data: tabel === 'arnobot_blog_sessions' ? state.sessie : null })
  b.upsert = async (rijen: { key: string; value: string }[]) => { state.upserts.push(rijen); return { error: null } }
  b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: tabel === 'arnobot_rds_logs' ? state.logs : tabel === 'arnobot_meta' ? state.metaRijen : [] }).then(ok)
  return b
}

const { GET } = await import('./route')
const aanroep = (geheim?: string) => GET(new NextRequest('https://www.arno.bot/api/cron/sessies-afsluiten', { headers: geheim ? { authorization: `Bearer ${geheim}` } : {} }))
const kandidaat = (over: Partial<{ session_id: string; user_id: string }> = {}) => ({ session_id: 's1', user_id: 'user_echt_1', vragen: 2, laatste: '2026-10-31T08:00:00Z', ...over })

beforeEach(() => {
  mockRpc.mockReset(); mockFrom.mockReset(); mockNotify.mockReset(); mockFetch.mockReset()
  mockFrom.mockImplementation(bouwer)
  state.logs = [{ question: 'vraag 1', answer: 'antwoord 1' }, { question: 'vraag 2', answer: 'antwoord 2' }]
  state.sessie = null; state.metaRijen = []; state.upserts = []
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
})

describe('cron/sessies-afsluiten', () => {
  it('weigert zonder het juiste CRON_SECRET', async () => {
    expect((await aanroep()).status).toBe(401)
    expect((await aanroep('fout')).status).toBe(401)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('sluit een kandidaat af via session-end met het geheim, de gebruiker en alle berichten', async () => {
    mockRpc.mockResolvedValue({ data: [kandidaat()], error: null })
    const res = await aanroep('geheim')
    expect(await res.json()).toMatchObject({ ok: true, afgesloten: 1, mislukt: 0 })
    expect(mockRpc).toHaveBeenCalledWith('sessies_zonder_actuele_synthese', { stil_uur: 12, venster_uur: 36, max_aantal: 36 })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://www.arno.bot/api/bot/session-end')
    expect(init.headers.Authorization).toBe('Bearer geheim')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ sessionId: 's1', cronUserId: 'user_echt_1', explicitClose: false, startedFromCommunity: false })
    expect(body.messages).toEqual([
      { role: 'user', content: 'vraag 1' }, { role: 'arno', content: 'antwoord 1' },
      { role: 'user', content: 'vraag 2' }, { role: 'arno', content: 'antwoord 2' },
    ])
  })

  it('houdt een gesprek dat al als community-uitgesloten staat uitgesloten', async () => {
    mockRpc.mockResolvedValue({ data: [kandidaat()], error: null })
    state.sessie = { community_excluded: true }
    await aanroep('geheim')
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).startedFromCommunity).toBe(true)
  })

  it('slaat interne testaccounts over', async () => {
    const { E2E_TEST_USER_ID } = await import('@/lib/internalTestAccounts')
    mockRpc.mockResolvedValue({ data: [kandidaat({ user_id: E2E_TEST_USER_ID })], error: null })
    const res = await aanroep('geheim')
    expect(await res.json()).toMatchObject({ afgesloten: 0 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('telt een mislukking en meldt pas bij de derde poging', async () => {
    mockRpc.mockResolvedValue({ data: [kandidaat()], error: null })
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })

    await aanroep('geheim')
    expect(state.upserts.at(-1)![0]).toMatchObject({ key: 'sessie_afsluit_fail:s1', value: '1' })
    expect(mockNotify).not.toHaveBeenCalled()

    state.metaRijen = [{ key: 'sessie_afsluit_fail:s1', value: '2' }]
    await aanroep('geheim')
    expect(state.upserts.at(-1)![0]).toMatchObject({ value: '3' })
    expect(mockNotify).toHaveBeenCalledTimes(1)
  })

  it('probeert een sessie die al 3 keer mislukte niet opnieuw', async () => {
    mockRpc.mockResolvedValue({ data: [kandidaat()], error: null })
    state.metaRijen = [{ key: 'sessie_afsluit_fail:s1', value: '3' }]
    const res = await aanroep('geheim')
    expect(await res.json()).toMatchObject({ afgesloten: 0 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('meldt een fout in de selectie en geeft 500', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'functie bestaat niet' } })
    expect((await aanroep('geheim')).status).toBe(500)
    expect(mockNotify).toHaveBeenCalledTimes(1)
  })
})
