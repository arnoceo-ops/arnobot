import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/rag', () => ({ embedSessionQuery: vi.fn(async () => [0]) }))
vi.mock('@/lib/memoryEntities', () => ({ findRecurringEntitiesInQuestion: vi.fn(async () => []) }))

const {
  geheugenDatum, isOudGeheugen, geheugenOnderwerp, detectSparringReference,
  haalGeheugenContext, bouwProfielContext, haalGesprekPeriodes,
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

// Minimale nep-Supabase: elke query op een tabel geeft de vaste rijen terug. Alleen de filters op
// session_id tellen mee, want of het open gesprek wel of niet in het geheugen komt hangt daaraan.
type Rij = Record<string, unknown>
function nepSupabase(tabellen: Record<string, Rij[]>) {
  const bouwer = (tabel: string) => {
    const b: Record<string, unknown> = {}
    let rijen = tabellen[tabel] ?? []
    for (const m of ['select', 'neq', 'is', 'in', 'gte', 'lte', 'order', 'limit', 'range']) b[m] = () => b
    b.eq = (kolom: string, waarde: unknown) => {
      if (kolom === 'session_id') rijen = rijen.filter(r => r.session_id === undefined || r.session_id === waarde)
      return b
    }
    b.not = (kolom: string, _op: string, waarde: unknown) => {
      if (kolom === 'session_id') rijen = rijen.filter(r => r.session_id !== waarde)
      return b
    }
    b.maybeSingle = async () => ({ data: rijen[0] ?? null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rijen }).then(ok)
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

  const geschiedenis = [{ role: 'user', content: 'vraag' }, { role: 'assistant', content: 'antwoord' }]
  const voortgezet = (dagenStil: number, eigen: Rij, andere: Rij[] = []) => haalGeheugenContext(
    nepSupabase({
      arnobot_blog_sessions: [...andere, { ...eigen, session_id: 'huidig' }],
      arnobot_rds_logs: [{ created_at: dagenGeleden(dagenStil) }],
    }),
    { ...basis, sessionId: 'huidig', history: geschiedenis },
  )

  it('laat een voortgezet gesprek tot en met 30 dagen stilte in zijn geheel meegaan, zonder extra tekst', async () => {
    for (const dagen of [4, 30]) {
      const r = await voortgezet(dagen, { ...RECENT, created_at: dagenGeleden(dagen) })
      expect(r.verouderd).toBe(false)
      // De berichten gaan zelf mee, dus het open gesprek staat niet ook nog in het geheugen.
      expect(r.geheugentekst).not.toContain('SAMENVATTING_RECENT')
      expect(r.geheugentekst).not.toContain('EERDER DEEL VAN DIT GESPREK')
      expect(r.prevSessionCount).toBe(0)
    }
  })

  it('kantelt boven de 30 dagen, niet erop', async () => {
    const eigen = { ...RECENT, created_at: dagenGeleden(30) }
    expect((await voortgezet(30, eigen)).verouderd).toBe(false)
    expect((await voortgezet(30.01, eigen)).verouderd).toBe(true)
  })

  it('geeft na meer dan 30 dagen het eigen gesprek met samenvatting, feiten en datum, tot 6 weken oud', async () => {
    const r = await voortgezet(31, { ...RECENT, created_at: dagenGeleden(31) })
    expect(r.verouderd).toBe(true)
    expect(r.geheugentekst).toContain('SAMENVATTING_RECENT')
    expect(r.geheugentekst).toContain('FEIT_RECENT')
    expect(r.geheugentekst).toContain('4 weken geleden')
    expect(r.prevSessionCount).toBe(1)
  })

  it('geeft van een eigen gesprek ouder dan 6 weken alleen het onderwerp en de blijvende feiten', async () => {
    const r = await voortgezet(115, OUD)
    expect(r.verouderd).toBe(true)
    expect(r.geheugentekst).toContain('Verbetertraject voor klant')
    expect(r.geheugentekst).toContain('Gebruiker verkoopt software aan MKB')
    expect(r.geheugentekst).not.toContain('SAMENVATTING_OUD_TRAJECT_LOOPT')
    expect(r.geheugentekst).not.toContain('FEIT_OUD_DEAL_STAAT_OPEN')
  })

  it('geeft bij voortzetten na meer dan 30 dagen hetzelfde geheugen als een nieuw gesprek', async () => {
    const ander = { ...RECENT, session_id: 'ander', summary: 'ANDER_GESPREK', feiten: 'ANDER_FEIT' }
    for (const eigen of [{ ...RECENT, created_at: dagenGeleden(35) }, OUD]) {
      const voort = await voortgezet(31, eigen, [ander])
      const vers = await haalGeheugenContext(
        nepSupabase({ arnobot_blog_sessions: [ander, { ...eigen, session_id: 'huidig' }] }),
        basis,
      )
      expect(voort.geheugentekst).toBe(vers.geheugentekst)
      expect(voort.prevSessionCount).toBe(vers.prevSessionCount)
    }
  })


  const berichten = (sessie: string, ...dagen: number[]) => dagen.map(n => ({ session_id: sessie, created_at: dagenGeleden(n) }))
  const metBerichten = (sessie: Rij, ...dagen: number[]) => haalGeheugenContext(
    nepSupabase({ arnobot_blog_sessions: [sessie], arnobot_rds_logs: berichten(String(sessie.session_id), ...dagen) }),
    basis,
  )

  it('telt de leeftijd vanaf het laatste bericht en noemt het begin, bij een gesprek van hooguit 30 dagen', async () => {
    // Rij van 50 dagen oud (eerste opslag), daarna voortgezet tot 25 dagen geleden.
    const r = await metBerichten({ ...RECENT, created_at: dagenGeleden(50) }, 50, 25)
    expect(r.geheugentekst).toContain('SAMENVATTING_RECENT')
    expect(r.geheugentekst).toContain('FEIT_RECENT')
    expect(r.geheugentekst).toContain('4 weken geleden, gesprek begonnen op 11 september 2026')
    expect(r.geheugentekst).not.toContain('OUDE ONDERWERPEN')
  })

  it('houdt bij een gesprek dat meer dan 30 dagen overspant de begindatum aan, zodat oud niet recent wordt', async () => {
    const r = await metBerichten(OUD, 115, 3)
    expect(r.geheugentekst).toContain('OUDE ONDERWERPEN')
    expect(r.geheugentekst).not.toContain('SAMENVATTING_OUD_TRAJECT_LOOPT')
    expect(r.geheugentekst).not.toContain('FEIT_OUD_DEAL_STAAT_OPEN')
    expect(r.geheugentekst).not.toContain('3 dagen geleden')
  })

  it('noemt geen begin als het gesprek op een dag is gevoerd, en valt zonder berichten terug op de rij', async () => {
    const eenDag = await metBerichten(RECENT, 10, 10)
    expect(eenDag.geheugentekst).toContain('10 dagen geleden')
    expect(eenDag.geheugentekst).not.toContain('gesprek begonnen op')
    const zonder = await haalGeheugenContext(nepSupabase({ arnobot_blog_sessions: [RECENT] }), basis)
    expect(zonder.geheugentekst).toContain('10 dagen geleden')
  })

  it('haalt alle berichtdata op, ook boven de 1000 rijen, en niets bij een fout', async () => {
    const paginas = (fout: boolean) => ({ from: () => {
      const b: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order']) b[m] = () => b
      b.range = async (van: number) => fout && van > 0
        ? { data: null, error: { message: 'stuk' } }
        : { data: Array.from({ length: van === 0 ? 1000 : 1 }, () => ({ session_id: 'a', created_at: dagenGeleden(van === 0 ? 9 : 2) })), error: null }
      return b
    } }) as never
    expect((await haalGesprekPeriodes(paginas(false), 'u1', ['a'])).get('a')).toEqual({ eerste: dagenGeleden(9), laatste: dagenGeleden(2) })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await haalGesprekPeriodes(paginas(true), 'u1', ['a'])).size).toBe(0)
  })

  it('zet het mailpatroon in de prompt vanaf 3 gesprekken met een mailverzoek, niet eerder', async () => {
    const mail = (n: number) => Array.from({ length: n }, (_, i) => ({ ...RECENT, session_id: 'm' + i, mail_verzoek: true }))
    const geen = await haalGeheugenContext(nepSupabase({ arnobot_blog_sessions: [RECENT, ...mail(2)] }), basis)
    expect(geen.geheugentekst).not.toContain('MAILPATROON')
    const wel = await haalGeheugenContext(nepSupabase({ arnobot_blog_sessions: [RECENT, ...mail(3)] }), basis)
    expect(wel.geheugentekst).toContain('MAILPATROON (3 van de laatste 4 gesprekken')
  })

  it('behandelt een gesprek van een paar uur terug niet als verouderd', async () => {
    const r = await haalGeheugenContext(
      nepSupabase({ arnobot_blog_sessions: [], arnobot_rds_logs: [{ created_at: new Date(NU.getTime() - 3 * 3_600_000).toISOString() }] }),
      { ...basis, sessionId: 'huidig', history: [{ role: 'user', content: 'vraag' }, { role: 'assistant', content: 'antwoord' }] },
    )
    expect(r.verouderd).toBe(false)
  })
})
