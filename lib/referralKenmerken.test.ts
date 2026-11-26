/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ gemeld: [] as unknown[] }))
vi.mock('@sentry/nextjs', () => ({ captureException: (e: unknown) => h.gemeld.push(e) }))

import { bewaarEersteProefStart, bewaarOoitTeamlid, eersteProefStart, zetGratisKenmerk } from './referralKenmerken'

function db(error: { message: string } | null) {
  const vragen: unknown[] = []
  const q: any = {
    update: (w: unknown) => { vragen.push(['update', w]); return q },
    eq: (...a: unknown[]) => { vragen.push(['eq', ...a]); return q },
    is: async (...a: unknown[]) => { vragen.push(['is', ...a]); return { error } },
  }
  return { client: { from: () => q } as any, vragen }
}

beforeEach(() => { h.gemeld = [] })

describe('eenmalig vastleggen', () => {
  it('schrijft alleen als het veld nog leeg is', async () => {
    const { client, vragen } = db(null)
    await bewaarEersteProefStart(client, 'u', '2027-01-01T00:00:00Z')
    expect(vragen).toEqual([['update', { eerste_proef_start: '2027-01-01T00:00:00Z' }], ['eq', 'user_id', 'u'], ['is', 'eerste_proef_start', null]])
  })
  it('zonder datum gebeurt er niets', async () => {
    const { client, vragen } = db(null)
    await bewaarEersteProefStart(client, 'u', null)
    expect(vragen).toEqual([])
  })
  it.each([
    'column approved_users.ooit_teamlid_at does not exist',
    "Could not find the 'ooit_teamlid_at' column of 'approved_users' in the schema cache",
  ])('ontbrekende kolom is stil: %s', async message => {
    await bewaarOoitTeamlid(db({ message }).client, 'u')
    expect(h.gemeld).toEqual([])
  })
  it('een andere fout gaat naar Sentry en gooit niet', async () => {
    await bewaarOoitTeamlid(db({ message: 'time-out' }).client, 'u')
    expect(h.gemeld).toHaveLength(1)
  })
})

describe('kenmerk gratis account', () => {
  function gratisDb(sinds: string | null, fouten: { lees?: string; log?: string; schrijf?: string } = {}) {
    const stappen: unknown[] = []
    const fout = (m?: string) => (m ? { message: m } : null)
    const client = {
      from: (tabel: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { gratis_sinds: sinds }, error: fout(fouten.lees) }) }) }),
        insert: async (rij: unknown) => { stappen.push([tabel, 'insert', rij]); return { error: fout(fouten.log) } },
        update: (w: unknown) => ({ eq: async () => { stappen.push([tabel, 'update', w]); return { error: fout(fouten.schrijf) } } }),
      }),
    } as any
    return { client, stappen }
  }

  it('aan bewaart de eerste datum', async () => {
    const { client, vragen } = db(null)
    expect(await zetGratisKenmerk(client, 'u', true)).toBe(true)
    expect(vragen.slice(1)).toEqual([['eq', 'user_id', 'u'], ['is', 'gratis_sinds', null]])
  })
  it('uit legt eerst vast dat het account gratis was en maakt dan het veld leeg', async () => {
    const { client, stappen } = gratisDb('2027-01-01T00:00:00Z')
    expect(await zetGratisKenmerk(client, 'u', false)).toBe(true)
    expect(stappen).toEqual([
      ['arnobot_admin_log', 'insert', expect.objectContaining({ actie: 'gratis_beeindigd', doel_user_id: 'u' })],
      ['approved_users', 'update', { gratis_sinds: null }],
    ])
  })
  it('zonder kenmerk wordt er niets geschreven', async () => {
    const { client, stappen } = gratisDb(null)
    expect(await zetGratisKenmerk(client, 'u', false)).toBe(true)
    expect(stappen).toEqual([])
  })
  it('lukt de logregel niet, dan blijft het kenmerk staan', async () => {
    const { client, stappen } = gratisDb('2027-01-01T00:00:00Z', { log: 'time-out' })
    expect(await zetGratisKenmerk(client, 'u', false)).toBe(false)
    expect(stappen).toHaveLength(1)
    expect(h.gemeld).toHaveLength(1)
  })
  it('een databasefout gooit nooit maar geeft false', async () => {
    expect(await zetGratisKenmerk(db({ message: 'time-out' }).client, 'u', true)).toBe(false)
    expect(await zetGratisKenmerk(gratisDb(null, { lees: 'time-out' }).client, 'u', false)).toBe(false)
    expect(h.gemeld).toHaveLength(2)
  })
})

describe('welke proefstart telt', () => {
  it('bewaard, anders de huidige zonder herstart, anders de terugval', () => {
    expect(eersteProefStart({ eerste_proef_start: 'a', trial_start: 'b' }, 'c')).toBe('a')
    expect(eersteProefStart({ trial_start: 'b' }, 'c')).toBe('b')
    expect(eersteProefStart({ trial_start: 'b', trial_reactivated_at: 'x' }, 'c')).toBe('c')
    expect(eersteProefStart({ trial_start: null }, 'c')).toBe('c')
    expect(eersteProefStart(null, null)).toBeNull()
  })
})
