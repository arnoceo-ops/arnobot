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
  it('aan bewaart de eerste datum', async () => {
    const { client, vragen } = db(null)
    await zetGratisKenmerk(client, 'u', true)
    expect(vragen.slice(1)).toEqual([['eq', 'user_id', 'u'], ['is', 'gratis_sinds', null]])
  })
  it('uit maakt het veld leeg', async () => {
    const vragen: unknown[] = []
    const client = { from: () => ({ update: (w: unknown) => ({ eq: async (...a: unknown[]) => { vragen.push(w, a); return { error: null } } }) }) } as any
    await zetGratisKenmerk(client, 'u', false)
    expect(vragen).toEqual([{ gratis_sinds: null }, ['user_id', 'u']])
  })
  it('een databasefout gooit nooit maar gaat naar Sentry', async () => {
    await zetGratisKenmerk(db({ message: 'time-out' }).client, 'u', true)
    expect(h.gemeld).toHaveLength(1)
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
