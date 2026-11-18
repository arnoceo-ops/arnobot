import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ruimDocumentenOp, TOMBSTONE_BEWAARTIJD_MS } from './documentenOpruimen'
import { DOCUMENTEN_BUCKET } from './documentenRegels'

type Aanroep = { methode: string; args: unknown[] }
type Resultaat = { data?: unknown; error?: { message: string } | null }
type Item = { id: string | null; name: string; created_at: string }

const NU = new Date('2026-11-20T12:00:00.000Z')
const uurGeleden = (n: number) => new Date(NU.getTime() - n * 3600 * 1000).toISOString()
const USER = 'user_abc'
const UUID = '3f2b8c1e-5a7d-4e9a-8b6c-1d2e3f4a5b6c'
const PAD = `${USER}/${UUID}.pdf`

const heeft = (k: Aanroep[], methode: string, kolom?: string) => k.some(a => a.methode === methode && (kolom === undefined || a.args[0] === kolom))

// Een nagemaakte Supabase-client: `tabel` bepaalt per query het antwoord, `lijst` de inhoud van de buckets.
function maakDb(opt: {
  tabel?: (ketting: Aanroep[]) => Resultaat
  lijst?: Record<string, Record<string, Item[]>>
  removeFout?: (bucket: string, paden: string[]) => { message: string } | null
} = {}) {
  const queries: { tabel: string; ketting: Aanroep[] }[] = []
  const verwijderd: { bucket: string; paden: string[] }[] = []
  const db = {
    from(tabel: string) {
      const rec = { tabel, ketting: [] as Aanroep[] }
      queries.push(rec)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = {}
      for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'not', 'lt', 'lte', 'order', 'limit']) {
        b[m] = (...args: unknown[]) => { rec.ketting.push({ methode: m, args }); return b }
      }
      b.then = (res: (v: Resultaat) => unknown, rej: (e: unknown) => unknown) => {
        try { return Promise.resolve(opt.tabel?.(rec.ketting) ?? { data: [], error: null }).then(res, rej) } catch (e) { return Promise.reject(e).then(res, rej) }
      }
      return b
    },
    storage: {
      from(bucket: string) {
        return {
          list: async (pad: string) => ({ data: opt.lijst?.[bucket]?.[pad] ?? [], error: null }),
          remove: async (paden: string[]) => {
            const fout = opt.removeFout?.(bucket, paden) ?? null
            if (!fout) verwijderd.push({ bucket, paden })
            return { error: fout }
          },
        }
      },
    },
  }
  return { db: db as unknown as SupabaseClient, queries, verwijderd }
}

const verlopenRij = (over: Partial<{ id: string; user_id: string; storage_path: string | null }> = {}) =>
  ({ id: 'd1', user_id: USER, storage_path: PAD, ...over })

describe('verlopen tijdelijke documenten', () => {
  it('ruimt het bestand op en laat een grafsteen achter met alleen de naam, nooit via een bewaard document', async () => {
    const { db, queries, verwijderd } = maakDb({
      tabel: k => (k[0].methode === 'select' && heeft(k, 'lte') ? { data: [verlopenRij()] } : { data: [], error: null }),
    })
    const r = await ruimDocumentenOp(db, NU)
    expect(r).toEqual({ verlopen: 1, grafstenenGewist: 0, weesbestanden: 0, fouten: [] })
    expect(verwijderd).toEqual([{ bucket: DOCUMENTEN_BUCKET, paden: [PAD] }])

    const zoek = queries[0].ketting
    expect(zoek.some(a => a.methode === 'eq' && a.args[0] === 'bewaard' && a.args[1] === false)).toBe(true)
    expect(zoek.some(a => a.methode === 'is' && a.args[0] === 'verwijderd_op' && a.args[1] === null)).toBe(true)
    expect(zoek.find(a => a.methode === 'lte')?.args).toEqual(['verloopt_op', NU.toISOString()])

    const update = queries.find(q => q.ketting[0]?.methode === 'update')!
    expect(update.ketting[0].args[0]).toEqual({ storage_path: null, tekst_cache: null, samenvatting: null, verwijderd_op: NU.toISOString() })
    expect(update.ketting.some(a => a.methode === 'eq' && a.args[0] === 'id' && a.args[1] === 'd1')).toBe(true)
    expect(update.ketting.some(a => a.methode === 'eq' && a.args[0] === 'user_id' && a.args[1] === USER)).toBe(true)
  })

  it('laat de rij ongemoeid als het bestand niet te verwijderen is, zodat de volgende run het opnieuw probeert', async () => {
    const { db, queries } = maakDb({
      tabel: k => (k[0].methode === 'select' && heeft(k, 'lte') ? { data: [verlopenRij()] } : { data: [], error: null }),
      removeFout: bucket => (bucket === DOCUMENTEN_BUCKET ? { message: 'storage kapot' } : null),
    })
    const r = await ruimDocumentenOp(db, NU)
    expect(r.verlopen).toBe(0)
    expect(r.fouten).toHaveLength(1)
    expect(r.fouten[0]).toContain('bestand verwijderen mislukt')
    expect(queries.some(q => q.ketting[0]?.methode === 'update')).toBe(false)
  })

  it('verwijdert nooit een bestand op een pad dat niet van de eigenaar is', async () => {
    const { db, queries, verwijderd } = maakDb({
      tabel: k => (k[0].methode === 'select' && heeft(k, 'lte') ? { data: [verlopenRij({ storage_path: `user_xyz/${UUID}.pdf` })] } : { data: [], error: null }),
    })
    const r = await ruimDocumentenOp(db, NU)
    expect(verwijderd).toEqual([])
    expect(queries.some(q => q.ketting[0]?.methode === 'update')).toBe(false)
    expect(r.fouten[0]).toContain('ongeldig opslagpad')
  })

  it('maakt ook een document zonder bestand (transcript) tot grafsteen', async () => {
    const { db, queries, verwijderd } = maakDb({
      tabel: k => (k[0].methode === 'select' && heeft(k, 'lte') ? { data: [verlopenRij({ storage_path: null })] } : { data: [], error: null }),
    })
    const r = await ruimDocumentenOp(db, NU)
    expect(r.verlopen).toBe(1)
    expect(verwijderd).toEqual([])
    expect(queries.some(q => q.ketting[0]?.methode === 'update')).toBe(true)
  })
})

describe('oude grafstenen', () => {
  it('wist grafstenen na 30 dagen', async () => {
    const { db, queries } = maakDb({
      tabel: k => (k[0].methode === 'delete' ? { data: [{ id: 'a' }, { id: 'b' }], error: null } : { data: [], error: null }),
    })
    const r = await ruimDocumentenOp(db, NU)
    expect(r.grafstenenGewist).toBe(2)
    const del = queries.find(q => q.ketting[0]?.methode === 'delete')!
    expect(del.ketting.find(a => a.methode === 'lt')?.args).toEqual(['verwijderd_op', new Date(NU.getTime() - TOMBSTONE_BEWAARTIJD_MS).toISOString()])
    expect(del.ketting.some(a => a.methode === 'not' && a.args[0] === 'verwijderd_op' && a.args[1] === 'is' && a.args[2] === null)).toBe(true)
  })
})

describe('achtergebleven uploads', () => {
  const lijst = {
    [DOCUMENTEN_BUCKET]: {
      '': [{ id: null, name: USER, created_at: uurGeleden(100) }],
      [USER]: [
        { id: '1', name: 'oud-wees.pdf', created_at: uurGeleden(30) },
        { id: '2', name: 'oud-bezet.pdf', created_at: uurGeleden(30) },
        { id: '3', name: 'jong.pdf', created_at: uurGeleden(2) },
      ],
    },
    'chat-audio-uploads': {
      '': [{ id: null, name: 'user_xyz', created_at: uurGeleden(100) }],
      user_xyz: [
        { id: '4', name: 'oud.mp3', created_at: uurGeleden(30) },
        { id: '5', name: 'jong.mp3', created_at: uurGeleden(1) },
      ],
    },
  }

  it('haalt oude ongebruikte bestanden weg, laat jonge en nog gebruikte staan', async () => {
    const { db, verwijderd } = maakDb({
      lijst,
      tabel: k => (k[0].methode === 'select' && heeft(k, 'in') ? { data: [{ storage_path: `${USER}/oud-bezet.pdf` }] } : { data: [], error: null }),
    })
    const r = await ruimDocumentenOp(db, NU)
    expect(r.weesbestanden).toBe(2)
    expect(verwijderd).toEqual([
      { bucket: DOCUMENTEN_BUCKET, paden: [`${USER}/oud-wees.pdf`] },
      { bucket: 'chat-audio-uploads', paden: ['user_xyz/oud.mp3'] },
    ])
  })

  it('verwijdert in de documentenbucket niets als de controle op rijen mislukt', async () => {
    const { db, verwijderd } = maakDb({
      lijst,
      tabel: k => (k[0].methode === 'select' && heeft(k, 'in') ? { data: null, error: { message: 'db weg' } } : { data: [], error: null }),
    })
    const r = await ruimDocumentenOp(db, NU)
    expect(verwijderd.find(v => v.bucket === DOCUMENTEN_BUCKET)).toBeUndefined()
    expect(r.fouten.some(f => f.includes('controle op rijen mislukt'))).toBe(true)
    // de oude bucket heeft geen rijen om te controleren en wordt wel opgeruimd
    expect(verwijderd).toEqual([{ bucket: 'chat-audio-uploads', paden: ['user_xyz/oud.mp3'] }])
  })
})

describe('een fout in één stap', () => {
  it('stopt de andere stappen niet', async () => {
    const { db } = maakDb({
      tabel: k => {
        if (k[0].methode === 'select' && heeft(k, 'lte')) return { data: null, error: { message: 'select kapot' } }
        if (k[0].methode === 'delete') return { data: [{ id: 'a' }], error: null }
        return { data: [], error: null }
      },
    })
    const r = await ruimDocumentenOp(db, NU)
    expect(r.fouten).toEqual(['verlopen documenten: select kapot'])
    expect(r.grafstenenGewist).toBe(1)
  })
  it('geeft niets terug en geen fouten als er niets te doen is', async () => {
    const { db } = maakDb()
    expect(await ruimDocumentenOp(db, NU)).toEqual({ verlopen: 0, grafstenenGewist: 0, weesbestanden: 0, fouten: [] })
  })
})
