import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc, mockAnthropicCreate } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockAnthropicCreate: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: mockRpc }),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockAnthropicCreate }
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { getRelevantChunksMultiQuery, getRelevantChunks } = await import('./rag')

function chunk(content: string, similarity = 0.9) {
  return { content, context: null, source: 'blogA', url: null, similarity }
}

describe('getRelevantChunksMultiQuery', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockFetch.mockReset()
  })

  it('voegt kandidaten van meerdere zoekzinnen samen en dedupliceert op content vóór rerank', async () => {
    // Beide zoekzinnen leveren dezelfde 2 kandidaten op via vector-search (mock simuleert
    // overlap tussen verschillende zoekzinnen, wat in de praktijk vaak voorkomt).
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'match_blog_chunks') {
        return Promise.resolve({ data: [chunk('Chunk A', 0.9), chunk('Chunk B', 0.8)], error: null })
      }
      if (fn === 'match_blog_chunks_fulltext') {
        return Promise.resolve({ data: [], error: null })
      }
      return Promise.resolve({ data: [], error: null })
    })

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/embeddings')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ embedding: [0.1, 0.2] }] }) })
      }
      if (url.includes('/rerank')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ results: [{ index: 0, relevance_score: 0.95 }, { index: 1, relevance_score: 0.7 }] }),
        })
      }
      return Promise.reject(new Error('onverwachte fetch-aanroep: ' + url))
    })

    const result = await getRelevantChunksMultiQuery(['zoekzin 1', 'zoekzin 2'], 'originele vraag', 10)

    expect(result.map(r => r.content)).toEqual(['Chunk A', 'Chunk B'])
    // searchCandidates wordt 1x per zoekzin aangeroepen (2 zoekzinnen = 2x vector + 2x fulltext)
    expect(mockRpc.mock.calls.filter(c => c[0] === 'match_blog_chunks')).toHaveLength(2)

    // Rerank moet op de ORIGINELE vraag draaien, niet op een van de (mogelijk afwijkende)
    // gegenereerde zoekzinnen, en op het huidige rerank-model.
    const rerankCall = mockFetch.mock.calls.find(c => (c[0] as string).includes('/rerank'))
    expect(rerankCall).toBeDefined()
    const rerankBody = JSON.parse(rerankCall![1].body)
    expect(rerankBody.query).toBe('originele vraag')
    expect(rerankBody.model).toBe('rerank-2.5')
  })

  it('geeft een lege lijst terug zonder rerank aan te roepen als er geen kandidaten zijn', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/embeddings')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ embedding: [0.1] }] }) })
      }
      return Promise.reject(new Error('rerank had niet aangeroepen moeten worden zonder kandidaten'))
    })

    const result = await getRelevantChunksMultiQuery(['zoekzin'], 'vraag', 10)
    expect(result).toEqual([])
  })

  it('gooit een fout door als de vector-zoekopdracht zelf faalt', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'match_blog_chunks') return Promise.resolve({ data: null, error: { message: 'db kapot' } })
      return Promise.resolve({ data: [], error: null })
    })
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [{ embedding: [0.1] }] }) })

    await expect(getRelevantChunksMultiQuery(['zoekzin'], 'vraag', 10)).rejects.toThrow('db kapot')
  })
})

describe('getRelevantChunks (single-query, gebruikt door andere routes dan de hoofdchat)', () => {
  beforeEach(() => {
    mockRpc.mockReset()
    mockFetch.mockReset()
  })

  it('gebruikt het embedding-model voyage-3-large, niet losstaand voyage-4-large', async () => {
    // Regressie-vangnet voor de live gevonden bug (2026-07): de kennisbank is offline
    // vooraf ge-embed met voyage-3-large. Een ander embedding-model voor alleen de live
    // zoekvraag levert 0 treffers op, ook al matcht de dimensie toevallig. Dit mag alleen
    // wijzigen als de hele kennisbank opnieuw is ge-embed (zie CLAUDE.md, Voyage AI-sectie).
    mockRpc.mockResolvedValue({ data: [], error: null })
    let embeddingModelUsed: string | undefined
    mockFetch.mockImplementation((url: string, opts: { body: string }) => {
      if (url.includes('/embeddings')) {
        embeddingModelUsed = JSON.parse(opts.body).model
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ embedding: [0.1] }] }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) })
    })

    await getRelevantChunks('een vraag', 15, false)
    expect(embeddingModelUsed).toBe('voyage-3-large')
  })
})
