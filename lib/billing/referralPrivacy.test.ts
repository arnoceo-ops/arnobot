/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exporteerReferralActies } from './referralExport'

// De nieuwe tabellen in de gegevensexport (alleen eigen gegevens) en in de verwijderchecklists.

function maakDb(tabellen: Record<string, any[]>, fout?: any) {
  const vragen: { tabel: string; kolommen: string; filter: [string, unknown][] }[] = []
  return {
    vragen,
    from(tabel: string) {
      const vraag = { tabel, kolommen: '', filter: [] as [string, unknown][] }
      vragen.push(vraag)
      const q: any = {
        select: (k: string) => { vraag.kolommen = k; return q },
        eq: (k: string, v: unknown) => { vraag.filter.push([k, v]); return q },
        order: () => q, limit: () => q,
        then: (ok: any) => ok(fout ? { data: null, error: fout } : {
          data: (tabellen[tabel] ?? []).filter(r => vraag.filter.every(([k, v]) => r[k] === v))
            .map(r => Object.fromEntries(vraag.kolommen.split(',').map(k => [k.trim(), r[k.trim()]]))),
          error: null,
        }),
      }
      return q
    },
  }
}

const actie = (user_id: string) => ({
  user_id, id: 'a1', referral_id: 'r1', doel_id: 'pay_x', soort: 'voordeel_maand', bruto_cent: 5900, netto_cent: 4876, status: 'bevestigd',
  created_at: '2027-02-01T00:00:00Z', mollie_refund_id: 're_1', gegevens: { omschrijving: 'x' }, fout: 'intern', melding: null,
})

describe('gegevensexport: referralacties en gratis periodes', () => {
  it('alleen eigen rijen, zonder kenmerken van de ander of interne velden', async () => {
    const db = maakDb({
      arnobot_referral_acties: [actie('ik'), actie('ander')],
      arnobot_referral_gratis_periodes: [{ user_id: 'ik', periode_start: 'a', periode_einde: 'b', actie_id: 'a1' }, { user_id: 'ander', periode_start: 'c', periode_einde: 'd' }],
    })
    expect(await exporteerReferralActies(db as any, 'ik')).toEqual({
      uitkeringen: [{ created_at: '2027-02-01T00:00:00Z', soort: 'voordeel_maand', bruto_cent: 5900, netto_cent: 4876, status: 'bevestigd' }],
      gratis_periodes: [{ periode_start: 'a', periode_einde: 'b' }],
    })
    expect(db.vragen.every(v => v.filter.some(([k, w]) => k === 'user_id' && w === 'ik'))).toBe(true)
  })
  it('zonder de tabellen is de uitkomst leeg en mislukt de export niet', async () => {
    const db = maakDb({}, { code: 'PGRST205', message: "Could not find the table 'public.arnobot_referral_acties' in the schema cache" })
    expect(await exporteerReferralActies(db as any, 'ik')).toEqual({ uitkeringen: [], gratis_periodes: [] })
  })
  it('een andere fout wordt niet stil een lege export', async () => {
    await expect(exporteerReferralActies(maakDb({}, { message: 'time-out' }) as any, 'ik')).rejects.toThrow('time-out')
  })
  it('de exportroute neemt ze mee', () => {
    expect(readFileSync(join(__dirname, '../../app/api/bot/export/route.ts'), 'utf8')).toContain('exporteerReferralActies(supabaseAdmin, userId)')
  })
})

describe('verwijderchecklists', () => {
  it.each(['app/api/bot/delete-account/route.ts', 'app/api/cron/data-cleanup/route.ts'])('%s noemt de nieuwe tabellen', pad => {
    const tekst = readFileSync(join(__dirname, '../..', pad), 'utf8')
    expect(tekst).toContain('arnobot_referral_acties')
    expect(tekst).toContain('arnobot_referral_gratis_periodes')
  })
})
