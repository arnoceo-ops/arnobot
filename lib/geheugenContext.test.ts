import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/rag', () => ({ embedSessionQuery: vi.fn(async () => [0]) }))
vi.mock('@/lib/memoryEntities', () => ({ findRecurringEntitiesInQuestion: vi.fn(async () => []) }))

const {
  geheugenDatum, isOudGeheugen, geheugenOnderwerp, detectSparringReference,
  haalGeheugenContext, bouwProfielContext,
} = await import('./geheugenContext')

const NU = new Date('2026-10-31T10:00:00Z')
const dagenGeleden = (n: number) => new Date(NU.getTime() - n * 86_400_000).toISOString()

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NU) })
afterEach(() => { vi.useRealTimers() })

describe('geheugenDatum', () => {
  it('geeft bij recente herinneringen dagen of weken erbij', () => {
    expect(geheugenDatum(dagenGeleden(1))).toContain('1 dag geleden')
    expect(geheugenDatum(dagenGeleden(5))).toContain('5 dagen geleden')
    expect(geheugenDatum(dagenGeleden(21))).toContain('3 weken geleden')
  })
  it('geeft bij oude herinneringen alleen de datum met jaar, nooit "x maanden geleden"', () => {
    // Met "4 maanden geleden" verzon het model in 8 van 8 testruns "vier jaar geleden".
    const oud = geheugenDatum(dagenGeleden(115))
    expect(oud).toMatch(/2026/)
    expect(oud).not.toMatch(/geleden/)
  })
})

describe('isOudGeheugen', () => {
  it('kantelt op 42 dagen', () => {
    expect(isOudGeheugen(dagenGeleden(41))).toBe(false)
    expect(isOudGeheugen(dagenGeleden(43))).toBe(true)
  })
})

describe('geheugenOnderwerp', () => {
  it('valt terug op de titel en dan op een vaste tekst', () => {
    expect(geheugenOnderwerp({ onderwerp: 'Factuurvragen', title: 'x' })).toBe('Factuurvragen')
    expect(geheugenOnderwerp({ onderwerp: null, title: 'a'.repeat(100) })).toHaveLength(60)
    expect(geheugenOnderwerp({ onderwerp: null, title: null })).toBe('gesprek')
  })
})

describe('detectSparringReference', () => {
  it('herkent verwijzingen naar sparren', () => {
    expect(detectSparringReference('Hoe ging mijn sparsessie?')).toBe(true)
    expect(detectSparringReference('Hoe sluit ik een deal?')).toBe(false)
  })
})

describe('bouwProfielContext', () => {
  it('zet datum van vandaag en voornaam in de context', () => {
    const c = bouwProfielContext({ rol: 'AE Hunter' }, 'Sanne', NU)
    expect(c).toContain('VANDAAG IS zaterdag 31 oktober 2026')
    expect(c).toContain('DE GEBRUIKER HEET Sanne')
    expect(c).toContain('Rol: AE Hunter')
  })
  it('laat de naam weg als die onbekend is', () => {
    expect(bouwProfielContext(null, '', NU)).not.toContain('DE GEBRUIKER HEET')
  })
})

// Minimale nep-Supabase: elke query op een tabel geeft de vaste rijen terug. Voor dit geheugen telt
// alleen wat er in de tekst terechtkomt, niet hoe de query is gefilterd.
type Rij = Record<string, unknown>
function nepSupabase(tabellen: Record<string, Rij[]>) {
  const bouwer = (tabel: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'not', 'is', 'in', 'gte', 'lte', 'order', 'limit']) b[m] = () => b
    b.maybeSingle = async () => ({ data: (tabellen[tabel] ?? [])[0] ?? null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: tabellen[tabel] ?? [] }).then(ok)
    return b
  }
  return { from: (t: string) => bouwer(t), rpc: async () => ({ data: [], error: null }) } as never
}

const RECENT = {
  session_id: 'r1', title: 'Recent gesprek', summary: 'SAMENVATTING_RECENT', feiten: 'FEIT_RECENT',
  onderwerp: 'Offerte voor gemeente', feiten_blijvend: null, uitdaging: null, actie_status: null,
  created_at: dagenGeleden(10),
}
const OUD = {
  session_id: 'o1', title: 'Oud gesprek', summary: 'SAMENVATTING_OUD_TRAJECT_LOOPT', feiten: 'FEIT_OUD_DEAL_STAAT_OPEN\nFEIT_OUD_ROL',
  onderwerp: 'Verbetertraject voor klant', feiten_blijvend: 'Gebruiker verkoopt software aan MKB',
  uitdaging: null, actie_status: null, created_at: dagenGeleden(115),
}

describe('haalGeheugenContext', () => {
  const basis = { userId: 'u1', sessionId: 'nieuw', question: 'Wat vind je van deze mail?', history: undefined, plan: 'premium' as const }

  it('zet situatiefeiten en samenvatting van oude gesprekken NOOIT als feit in de prompt', async () => {
    const r = await haalGeheugenContext(nepSupabase({ arnobot_blog_sessions: [RECENT, OUD] }), basis)
    expect(r.geheugentekst).not.toContain('SAMENVATTING_OUD_TRAJECT_LOOPT')
    expect(r.geheugentekst).not.toContain('FEIT_OUD_DEAL_STAAT_OPEN')
    expect(r.geheugentekst).not.toContain('FEIT_OUD_ROL')
  })

  it('zet van oude gesprekken alleen het onderwerp en de blijvende feiten in de prompt', async () => {
    const r = await haalGeheugenContext(nepSupabase({ arnobot_blog_sessions: [RECENT, OUD] }), basis)
    expect(r.geheugentekst).toContain('Verbetertraject voor klant')
    expect(r.geheugentekst).toContain('BLIJVENDE FEITEN UIT OUDERE GESPREKKEN')
    expect(r.geheugentekst).toContain('Gebruiker verkoopt software aan MKB')
    expect(r.geheugentekst).toContain('OUDE ONDERWERPEN')
  })

  it('laat recente gesprekken wel met samenvatting en feiten meekomen, met datum', async () => {
    const r = await haalGeheugenContext(nepSupabase({ arnobot_blog_sessions: [RECENT, OUD] }), basis)
    expect(r.geheugentekst).toContain('SAMENVATTING_RECENT')
    expect(r.geheugentekst).toContain('FEIT_RECENT')
    expect(r.geheugentekst).toContain('10 dagen geleden')
  })

  it('valt bij ontbrekende labels terug op de titel en zet dan nooit feiten van toen in de prompt', async () => {
    const ongelabeld = { ...OUD, onderwerp: null, feiten_blijvend: null }
    const r = await haalGeheugenContext(nepSupabase({ arnobot_blog_sessions: [ongelabeld] }), basis)
    expect(r.geheugentekst).toContain('Oud gesprek')
    expect(r.geheugentekst).not.toContain('FEIT_OUD_DEAL_STAAT_OPEN')
    expect(r.geheugentekst).not.toContain('SAMENVATTING_OUD_TRAJECT_LOOPT')
    expect(r.geheugentekst).not.toContain('BLIJVENDE FEITEN')
  })

  it('markeert een gesprek van meer dan 48 uur terug als verouderd en gebruikt alleen het onderwerp van toen', async () => {
    const r = await haalGeheugenContext(
      nepSupabase({
        arnobot_blog_sessions: [{ ...OUD, session_id: 'huidig' }],
        arnobot_rds_logs: [{ created_at: dagenGeleden(115) }],
      }),
      { ...basis, sessionId: 'huidig', history: [{ role: 'user', content: 'vraag' }, { role: 'assistant', content: 'antwoord' }] },
    )
    expect(r.verouderd).toBe(true)
    expect(r.geheugentekst).toContain('EERDER DEEL VAN DIT GESPREK')
    expect(r.geheugentekst).toContain('Onderwerp van toen: Verbetertraject voor klant')
    expect(r.geheugentekst).not.toContain('SAMENVATTING_OUD_TRAJECT_LOOPT')
    expect(r.geheugentekst).not.toContain('FEIT_OUD_DEAL_STAAT_OPEN')
  })

  it('behandelt een gesprek van een paar uur terug niet als verouderd', async () => {
    const r = await haalGeheugenContext(
      nepSupabase({ arnobot_blog_sessions: [], arnobot_rds_logs: [{ created_at: new Date(NU.getTime() - 3 * 3_600_000).toISOString() }] }),
      { ...basis, sessionId: 'huidig', history: [{ role: 'user', content: 'vraag' }, { role: 'assistant', content: 'antwoord' }] },
    )
    expect(r.verouderd).toBe(false)
  })
})
