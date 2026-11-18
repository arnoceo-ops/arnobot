import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ruimBronContextOp, BRON_CONTEXT_BEWAARTIJD_MS } from './bronContextOpruimen'

type Aanroep = { methode: string; args: unknown[] }
type Resultaat = { data?: unknown; error?: { message: string } | null }

// Nagemaakte client: `groepen` zijn de ID's die elke opeenvolgende zoekopdracht teruggeeft.
function maakDb(groepen: (string | number)[][], opt: { zoekFout?: boolean; updateFout?: boolean } = {}) {
  const queries: { ketting: Aanroep[] }[] = []
  let zoekt = 0
  const db = {
    from(tabel: string) {
      if (tabel !== 'arnobot_rds_logs') throw new Error('onverwachte tabel ' + tabel)
      const rec = { ketting: [] as Aanroep[] }
      queries.push(rec)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = {}
      for (const m of ['select', 'update', 'not', 'lt', 'order', 'limit', 'in']) {
        b[m] = (...args: unknown[]) => { rec.ketting.push({ methode: m, args }); return b }
      }
      b.then = (res: (v: Resultaat) => unknown, rej: (e: unknown) => unknown) => {
        const eerste = rec.ketting[0]?.methode
        let r: Resultaat
        if (eerste === 'select') {
          r = opt.zoekFout ? { data: null, error: { message: 'zoeken kapot' } } : { data: (groepen[zoekt++] ?? []).map(id => ({ id })) }
        } else {
          r = opt.updateFout ? { error: { message: 'update kapot' } } : { error: null }
        }
        return Promise.resolve(r).then(res, rej)
      }
      return b
    },
  }
  return { db: db as unknown as SupabaseClient, queries }
}

const NU = new Date('2026-12-20T12:00:00.000Z')
const heeft = (k: Aanroep[], methode: string, ...args: unknown[]) => k.some(a => a.methode === methode && args.every((x, i) => JSON.stringify(a.args[i]) === JSON.stringify(x)))

describe('ruimBronContextOp', () => {
  it('doet niets als er niets ouder is dan 30 dagen', async () => {
    const { db, queries } = maakDb([[]])
    expect(await ruimBronContextOp(db, NU)).toEqual({ geleegd: 0, nogTeDoen: false })
    expect(queries.some(q => q.ketting[0]?.methode === 'update')).toBe(false)
  })
  it('zoekt alleen rijen met een bron_context die ouder zijn dan 30 dagen', async () => {
    const { db, queries } = maakDb([[1]])
    await ruimBronContextOp(db, NU)
    const zoek = queries[0].ketting
    expect(heeft(zoek, 'not', 'bron_context', 'is', null)).toBe(true)
    expect(heeft(zoek, 'lt', 'created_at', new Date(NU.getTime() - BRON_CONTEXT_BEWAARTIJD_MS).toISOString())).toBe(true)
  })
  it('maakt alleen bron_context leeg, en niets anders van de rij', async () => {
    const { db, queries } = maakDb([[1, 2, 3]])
    expect((await ruimBronContextOp(db, NU)).geleegd).toBe(3)
    const update = queries.find(q => q.ketting[0]?.methode === 'update')!
    expect(update.ketting[0].args[0]).toEqual({ bron_context: null })
    expect(heeft(update.ketting, 'in', 'id', [1, 2, 3])).toBe(true)
  })
  it('gaat in groepen door tot er niets meer is', async () => {
    const volle = Array.from({ length: 200 }, (_, i) => i)
    const { db } = maakDb([volle, [900, 901]])
    expect(await ruimBronContextOp(db, NU)).toEqual({ geleegd: 202, nogTeDoen: false })
  })
  it('meldt dat er nog werk is als de grens per run is bereikt', async () => {
    const volle = Array.from({ length: 200 }, (_, i) => i)
    const { db } = maakDb(Array.from({ length: 30 }, () => volle))
    const r = await ruimBronContextOp(db, NU)
    expect(r.geleegd).toBe(25 * 200)
    expect(r.nogTeDoen).toBe(true)
  })
  it('gooit een fout als zoeken of leegmaken mislukt', async () => {
    await expect(ruimBronContextOp(maakDb([[1]], { zoekFout: true }).db, NU)).rejects.toThrow('zoeken mislukt')
    await expect(ruimBronContextOp(maakDb([[1]], { updateFout: true }).db, NU)).rejects.toThrow('leegmaken mislukt')
  })
})
