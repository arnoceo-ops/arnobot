import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Bewijst de registratie in cron_runs zonder echte database: alleen geautoriseerde runs tellen, een
// succes en een mislukking komen op de goede kolommen, een uitzondering wordt doorgegeven, en een
// kapotte registratie laat de cron zelf nooit falen.

const { schrijfpogingen, state } = vi.hoisted(() => ({
  schrijfpogingen: [] as Record<string, unknown>[],
  state: { fout: false },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: async (rij: Record<string, unknown>) => {
        schrijfpogingen.push(rij)
        return { error: state.fout ? { message: 'tabel kapot' } : null }
      },
    }),
  }),
}))

process.env.CRON_SECRET = 'geheim'
const { registreerCronRun } = await import('./cronRun')

const req = (geheim: string | null, query = '') =>
  new NextRequest(`https://www.arno.bot/api/cron/x${query}`, { headers: geheim ? { authorization: `Bearer ${geheim}` } : {} })

beforeEach(() => {
  schrijfpogingen.length = 0
  state.fout = false
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('registreerCronRun', () => {
  it('registreert een start en een succes met de duur', async () => {
    const GET = registreerCronRun('/api/cron/x', async () => NextResponse.json({ ok: true }))
    const res = await GET(req('geheim'))
    expect(res.status).toBe(200)
    expect(schrijfpogingen).toHaveLength(2)
    expect(schrijfpogingen[0]).toMatchObject({ naam: '/api/cron/x' })
    expect(schrijfpogingen[0].laatste_start).toBeTypeOf('string')
    expect(schrijfpogingen[1]).toMatchObject({ naam: '/api/cron/x' })
    expect(schrijfpogingen[1].laatste_ok).toBeTypeOf('string')
    expect(schrijfpogingen[1].laatste_duur_ms).toBeTypeOf('number')
    expect(schrijfpogingen[1].laatste_fout).toBeUndefined()
  })

  it('registreert een HTTP-fout als mislukt, met de reden uit het antwoord, en geeft het antwoord ongewijzigd door', async () => {
    const GET = registreerCronRun('/api/cron/x', async () => NextResponse.json({ error: 'cron_error' }, { status: 500 }))
    const res = await GET(req('geheim'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'cron_error' })
    expect(schrijfpogingen[1].laatste_fout).toBeTypeOf('string')
    expect(schrijfpogingen[1].laatste_fout_tekst).toBe('HTTP 500: cron_error')
    expect(schrijfpogingen[1].laatste_ok).toBeUndefined()
  })

  it('registreert een uitzondering als mislukt en gooit hem opnieuw', async () => {
    const GET = registreerCronRun('/api/cron/x', async () => { throw new Error('boem') })
    await expect(GET(req('geheim'))).rejects.toThrow('boem')
    expect(schrijfpogingen[1].laatste_fout_tekst).toBe('boem')
  })

  it('registreert niets zonder het juiste CRON_SECRET', async () => {
    const GET = registreerCronRun('/api/cron/x', async () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    expect((await GET(req(null))).status).toBe(401)
    expect((await GET(req('fout'))).status).toBe(401)
    expect(schrijfpogingen).toHaveLength(0)
  })

  it('registreert een droge run (?dry) niet', async () => {
    const GET = registreerCronRun('/api/cron/x', async () => NextResponse.json({ ok: true }))
    expect((await GET(req('geheim', '?dry=1'))).status).toBe(200)
    expect(schrijfpogingen).toHaveLength(0)
  })

  it('laat de cron zelf slagen als de registratie faalt', async () => {
    state.fout = true
    const GET = registreerCronRun('/api/cron/x', async () => NextResponse.json({ ok: true, werk: 'gedaan' }))
    const res = await GET(req('geheim'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, werk: 'gedaan' })
  })
})
