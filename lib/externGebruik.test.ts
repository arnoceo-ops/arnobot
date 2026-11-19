import { describe, it, expect } from 'vitest'
import { assemblyAiRij, openAiTranscriptieRij, voyageKostenUsd, voyageRij } from './externGebruik'

describe('Voyage', () => {
  it('rekent de rerank tegen $0,05 per miljoen tokens', () => {
    expect(voyageKostenUsd('rerank-2.5', 70_000)).toBeCloseTo(0.0035, 8)
  })
  it('geeft kosten null voor een embedding-model zonder geverifieerd tarief, zodat het opvalt', () => {
    expect(voyageKostenUsd('voyage-3-large', 100)).toBeNull()
  })
  it('maakt een rij uit de usage van de respons, met de gebruiker en bron', () => {
    const rij = voyageRij({ usage: { total_tokens: 1234 }, data: [] }, 'rerank-2.5', 'user_a', 'rag-rerank')
    expect(rij).toMatchObject({ user_id: 'user_a', bron: 'rag-rerank', model: 'rerank-2.5', invoer: 1234, leverancier: 'voyage', afgebroken: false })
    expect(rij!.kosten_usd).toBeCloseTo(0.0000617, 7)
  })
  it('geeft niets terug zonder bruikbare usage', () => {
    expect(voyageRij({}, 'rerank-2.5', 'u', 'b')).toBeNull()
    expect(voyageRij(null, 'rerank-2.5', 'u', 'b')).toBeNull()
    expect(voyageRij({ usage: { total_tokens: 0 } }, 'rerank-2.5', 'u', 'b')).toBeNull()
  })
  it('zet een ontbrekende gebruiker op null', () => {
    expect(voyageRij({ usage: { total_tokens: 5 } }, 'rerank-2.5', undefined, 'b')!.user_id).toBeNull()
  })
})

describe('AssemblyAI', () => {
  it('rekent $0,23 per uur audio en bewaart de duur in seconden', () => {
    const rij = assemblyAiRij(1800, 'user_a', 'audio-bijlage')
    expect(rij).toMatchObject({ leverancier: 'assemblyai', hoeveelheid: 1800, eenheid: 'seconden', user_id: 'user_a' })
    expect(rij!.kosten_usd).toBeCloseTo(0.115, 6)
  })
  it('geeft niets terug zonder duur', () => {
    expect(assemblyAiRij(NaN, 'u', 'b')).toBeNull()
    expect(assemblyAiRij(0, 'u', 'b')).toBeNull()
  })
})

describe('OpenAI-transcriptie', () => {
  const sse = (usage: unknown) => [
    'data: {"type":"transcript.text.delta","delta":"ho"}',
    '',
    `data: ${JSON.stringify({ type: 'transcript.text.done', text: 'hoi', usage })}`,
    '',
    'data: [DONE]',
  ].join('\n')

  it('rekent bij een duur tegen $0,0045 per minuut', () => {
    const rij = openAiTranscriptieRij(sse({ type: 'duration', seconds: 120 }), 'user_a', 'dicteren')
    expect(rij).toMatchObject({ leverancier: 'openai', model: 'gpt-transcribe', hoeveelheid: 120, eenheid: 'seconden', user_id: 'user_a' })
    expect(rij!.kosten_usd).toBeCloseTo(0.009, 6)
  })
  it('bewaart bij tokens de aantallen zonder kosten (geen geverifieerd tarief per token)', () => {
    const rij = openAiTranscriptieRij(sse({ type: 'tokens', input_tokens: 300, output_tokens: 40 }), 'user_a', 'dicteren')
    expect(rij).toMatchObject({ invoer: 300, uitvoer: 40, kosten_usd: null, hoeveelheid: null })
  })
  it('geeft niets terug zonder usage of zonder afsluitende gebeurtenis', () => {
    expect(openAiTranscriptieRij('data: {"type":"transcript.text.delta","delta":"x"}', 'u', 'b')).toBeNull()
    expect(openAiTranscriptieRij(sse(undefined), 'u', 'b')).toBeNull()
    expect(openAiTranscriptieRij('rommel', 'u', 'b')).toBeNull()
  })
})
