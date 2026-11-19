import { describe, it, expect } from 'vitest'
import { leverancierUitModel, somKostenPerGebruiker } from './gebruikerKosten'
import { VOICE_USD_PER_1000_TEKENS } from './maandKosten'

describe('leverancierUitModel', () => {
  it('leidt de leverancier af uit de modelnaam', () => {
    expect(leverancierUitModel('claude-sonnet-4-6')).toBe('anthropic')
    expect(leverancierUitModel('voyage-3-large')).toBe('voyage')
    expect(leverancierUitModel('rerank-2.5')).toBe('voyage')
    expect(leverancierUitModel('universal-3-5-pro')).toBe('audio')
    expect(leverancierUitModel('gpt-transcribe')).toBe('audio')
    expect(leverancierUitModel(null)).toBe('onbekend')
  })
})

describe('somKostenPerGebruiker', () => {
  it('telt per gebruiker en per leverancier, inclusief voice, en negeert platformwerk zonder gebruiker', () => {
    const m = somKostenPerGebruiker(
      [
        { user_id: 'a', model: 'claude-sonnet-4-6', kosten_usd: '0.088442' },
        { user_id: 'a', model: 'claude-haiku-4-5-20251001', kosten_usd: 0.001 },
        { user_id: 'a', model: 'rerank-2.5', kosten_usd: 0.0035 },
        { user_id: 'b', model: 'universal-3-5-pro', kosten_usd: 0.115 },
        { user_id: null, model: 'claude-sonnet-4-6', kosten_usd: 5 },
      ],
      [{ user_id: 'a', char_count: 10_000 }, { user_id: null, char_count: 99_000 }],
    )
    const a = m.get('a')!
    expect(a.anthropicUsd).toBeCloseTo(0.089442, 6)
    expect(a.voyageUsd).toBeCloseTo(0.0035, 6)
    expect(a.voiceUsd).toBeCloseTo(10 * VOICE_USD_PER_1000_TEKENS, 6)
    expect(a.totaalUsd).toBeCloseTo(0.089442 + 0.0035 + 10 * VOICE_USD_PER_1000_TEKENS, 6)
    expect(m.get('b')!.audioUsd).toBeCloseTo(0.115, 6)
    expect(m.size).toBe(2)
  })
  it('telt een aanroep zonder bekend tarief apart en neemt hem niet mee in de euro', () => {
    const m = somKostenPerGebruiker([{ user_id: 'a', model: 'voyage-3-large', kosten_usd: null }, { user_id: 'a', model: 'claude-sonnet-4-6', kosten_usd: 0.1 }], [])
    expect(m.get('a')).toMatchObject({ zonderPrijs: 1, totaalUsd: 0.1 })
  })
})
