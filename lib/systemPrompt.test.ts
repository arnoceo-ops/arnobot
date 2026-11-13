import { describe, it, expect } from 'vitest'
import { buildRdsSystemPrompt, buildVoiceSystemPrompt } from './systemPrompt'

function joinBlocks(blocks: { text: string }[]) {
  return blocks.map(b => b.text).join('')
}

// Deze snapshots pinnen de EXACTE, volledige systeemprompt-tekst vast (inclusief
// regelwitruimte tussen blokken). Bij het opknippen in cache_control-blokken voor prompt
// caching (2026-07) viel op twee plekken een blanco regel tussen alinea's weg zonder dat dit
// zichtbaar was totdat de oude en nieuwe versie programmatisch werden vergeleken. Deze test
// vangt een vergelijkbare regressie automatisch, zonder dat iemand het toevallig moet
// opmerken.
describe('buildRdsSystemPrompt', () => {
  const profielContextSample = '\nPROFIEL:\n- Rol: Sales Manager\n'
  const contextSample = 'Voorbeeld kennisbank-context met wat inhoud.'

  it.each([
    ['kort', 0],
    ['kort', 5],
    ['normaal', 0],
    ['normaal', 5],
    ['uitgebreid', 0],
    ['uitgebreid', 5],
  ] as const)('produceert de verwachte tekst (antwoordLengte=%s, prevSessionCount=%s)', (antwoordLengte, prevSessionCount) => {
    const blocks = buildRdsSystemPrompt(profielContextSample, contextSample, 3, antwoordLengte, prevSessionCount)
    expect(joinBlocks(blocks)).toMatchSnapshot()
  })

  it('markeert alleen de eerste twee blokken als cachebaar, niet het dynamische contextblok', () => {
    const blocks = buildRdsSystemPrompt(profielContextSample, contextSample, 3, 'normaal', 0)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' })
    expect(blocks[2].cache_control).toBeUndefined()
  })

  it('bevat altijd de streepjes-instructie, ongeacht de parameters', () => {
    const blocks = buildRdsSystemPrompt(profielContextSample, contextSample, 3, 'normaal', 0)
    expect(joinBlocks(blocks)).toContain('Gebruik NOOIT een streepje als leesteken')
  })

  it('bevat de regel die persoonlijke uitspraken over Arno verbiedt', () => {
    const blocks = buildRdsSystemPrompt(profielContextSample, contextSample, 3, 'normaal', 0)
    expect(joinBlocks(blocks)).toContain('Doe nooit uitspraken over Arno Diepeveen als persoon')
  })
})

// De spraakroute heeft geen moderatiepoort (een extra aanroep kost latency), dus deze regel is
// daar de enige bescherming tegen verzonnen persoonlijke feiten.
describe('buildVoiceSystemPrompt', () => {
  it('bevat de regel die persoonlijke uitspraken over Arno verbiedt', () => {
    expect(joinBlocks(buildVoiceSystemPrompt())).toContain('Doe nooit uitspraken over Arno Diepeveen als persoon')
  })
})
