import { describe, it, expect } from 'vitest'
import { bereken, voerRekenToolUit, voerToolUit } from '@/lib/rekenTool'
import { vindFouteSommen, vindUVorm } from '@/lib/rekenControle'

describe('rekenTool', () => {
  it('rekent exact, met voorrang en haakjes', () => {
    expect(bereken('115 * 90')).toBe(10350)
    expect(bereken('61 * 90')).toBe(5490)
    expect(bereken('13800 + 5490 + 10350')).toBe(29640)
    expect(bereken('(115 * 120) + (61 * 90)')).toBe(19290)
    expect(bereken('120 * 0.75')).toBe(90)
    expect(bereken('2 + 3 * 4')).toBe(14)
    expect(bereken('-(2 + 3) * 2')).toBe(-10)
    expect(bereken('2 ^ 3 ^ 2')).toBe(512)
    expect(bereken('0.1 + 0.2')).toBe(0.3)
  })
  it('weigert ongeldige of gevaarlijke invoer, geen code-uitvoering', () => {
    for (const x of ['', '1 +', '(1 + 2', '1 / 0', 'process.exit()', 'constructor', '1; 2', '1e999', '9'.repeat(300)]) {
      expect(() => bereken(x)).toThrow()
    }
  })
  it('voerRekenToolUit geeft per expressie een regel en markeert fouten', () => {
    expect(voerRekenToolUit({ expressies: ['115 * 90', '61 * 90'] })).toEqual({ content: '115 * 90 = 10350\n61 * 90 = 5490', isError: false })
    expect(voerRekenToolUit({ expressies: ['1 / 0'] }).isError).toBe(true)
    expect(voerRekenToolUit(null).isError).toBe(true)
    expect(voerRekenToolUit({ expressies: [5] }).isError).toBe(true)
  })
})

describe('groeidoel', () => {
  it('rekent het doel op vorig jaar, niet op de huidige stand (de fout van 18 november)', () => {
    const r = voerToolUit('groeidoel', { vorig_jaar: 2146660, nu: 2271804, percentage: 10, erbij: 80000 })
    expect(r.isError).toBe(false)
    expect(r.content).toContain('= 2361326')
    expect(r.content).toContain('Tekort tot het doel: 89522')
    expect(r.content).toContain('9522 onder')
    expect(r.content).not.toContain('2498984')
  })
  it('meldt een gehaald doel en weigert ongeldige invoer', () => {
    expect(voerToolUit('groeidoel', { vorig_jaar: 100, nu: 120, percentage: 10 }).content).toContain('doel al gehaald')
    expect(voerToolUit('groeidoel', { vorig_jaar: 0, nu: 5, percentage: 10 }).isError).toBe(true)
    expect(voerToolUit('groeidoel', { vorig_jaar: 'x', nu: 5, percentage: 10 }).isError).toBe(true)
    expect(voerToolUit('onbekend', {}).isError).toBe(true)
  })
})

describe('rekenControle', () => {
  it('vindt de echte fouten uit de Thijs-sessie', () => {
    const f = vindFouteSommen('Partij 2: 61 m2 tegen 90 euro (25% korting) = 6.588 euro per jaar. Partij 3: 115 m2 tegen 90 euro (25% korting) = 12.420 euro per jaar.')
    expect(f.map(x => x.juist)).toEqual([5490, 10350])
  })
  it('laat juiste sommen en ketens met rust', () => {
    expect(vindFouteSommen('115 x 90 = 10.350 en 13.800 + 5.490 + 10.350 = 29.640')).toEqual([])
    expect(vindFouteSommen('2 maal 3 = 6')).toEqual([])
  })
  it('vindt "u" als aanspreekvorm', () => {
    expect(vindUVorm('Bent u zich als bestuur bewust van deze verstrengeling?')).toContain('Bent u')
    expect(vindUVorm('Je bent je als bestuur bewust. Hoe voelt dat?')).toBeNull()
  })
})
