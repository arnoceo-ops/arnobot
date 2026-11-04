import { describe, expect, it } from 'vitest'
import { beoordeelCapaciteit, DB_LIMIET_BYTES, type Meting } from './capaciteitDrempels'

const rustig: Meting = { resendPlan: 'gratis', mailDag: 9, mailMaand: 86, dbBytes: 200 * 1024 ** 2, anthropic429Dag: 0, actieveGebruikers: 10 }

describe('beoordeelCapaciteit', () => {
  it('meldt niets bij rustig verbruik (de stand van 2026-11-04)', () => {
    expect(beoordeelCapaciteit(rustig)).toEqual([])
  })

  it('Resend gratis: waarschuwing bij 70 van 100 mails per dag, kritiek bij 90', () => {
    expect(beoordeelCapaciteit({ ...rustig, mailDag: 69 })).toEqual([])
    expect(beoordeelCapaciteit({ ...rustig, mailDag: 70 }).map(m => m.sleutel)).toEqual(['resend-dag:waarschuwing'])
    expect(beoordeelCapaciteit({ ...rustig, mailDag: 90 }).map(m => m.sleutel)).toEqual(['resend-dag:kritiek'])
  })

  it('Resend gratis: maandlimiet van 3.000', () => {
    expect(beoordeelCapaciteit({ ...rustig, mailMaand: 2100 }).map(m => m.sleutel)).toEqual(['resend-maand:waarschuwing'])
    expect(beoordeelCapaciteit({ ...rustig, mailMaand: 2700 }).map(m => m.sleutel)).toEqual(['resend-maand:kritiek'])
  })

  it('Resend Pro: geen daglimiet, wel de maandlimiet van 50.000', () => {
    const pro = { ...rustig, resendPlan: 'pro' as const }
    expect(beoordeelCapaciteit({ ...pro, mailDag: 5000 })).toEqual([])
    expect(beoordeelCapaciteit({ ...pro, mailMaand: 35000 }).map(m => m.sleutel)).toEqual(['resend-maand:waarschuwing'])
  })

  it('database: meldt vanaf 70% van 8 GB, en slaat over als de functie ontbreekt', () => {
    expect(beoordeelCapaciteit({ ...rustig, dbBytes: DB_LIMIET_BYTES * 0.7 }).map(m => m.sleutel)).toEqual(['database:waarschuwing'])
    expect(beoordeelCapaciteit({ ...rustig, dbBytes: DB_LIMIET_BYTES * 0.95 }).map(m => m.sleutel)).toEqual(['database:kritiek'])
    expect(beoordeelCapaciteit({ ...rustig, dbBytes: null })).toEqual([])
  })

  it('Anthropic: elke limietfout is kritiek', () => {
    const r = beoordeelCapaciteit({ ...rustig, anthropic429Dag: 3 })
    expect(r).toHaveLength(1)
    expect(r[0].niveau).toBe('kritiek')
    expect(r[0].tekst).toContain('3 keer')
  })

  it('mijlpalen: 30, 50 en 150 actieve gebruikers, elk één keer per drempel', () => {
    expect(beoordeelCapaciteit({ ...rustig, actieveGebruikers: 29 })).toEqual([])
    expect(beoordeelCapaciteit({ ...rustig, actieveGebruikers: 30 }).map(m => m.sleutel)).toEqual(['mijlpaal:30'])
    expect(beoordeelCapaciteit({ ...rustig, actieveGebruikers: 50 }).map(m => m.sleutel)).toEqual(['mijlpaal:30', 'mijlpaal:50'])
    expect(beoordeelCapaciteit({ ...rustig, actieveGebruikers: 150 }).map(m => m.sleutel)).toEqual(['mijlpaal:30', 'mijlpaal:50', 'mijlpaal:150'])
  })

  it('geen streepjes als leesteken in de meldingen', () => {
    const alles = beoordeelCapaciteit({ resendPlan: 'gratis', mailDag: 95, mailMaand: 2900, dbBytes: DB_LIMIET_BYTES, anthropic429Dag: 2, actieveGebruikers: 200 })
    for (const m of alles) expect(m.tekst).not.toMatch(/[—–]/)
  })
})
