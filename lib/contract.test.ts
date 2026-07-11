import { describe, it, expect } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'

// Contracttests: verifiëren dat de lokale mock-servers (e2e/mocks/mockAnthropicServer.ts,
// mockVoyageServer.ts) nog overeenkomen met de daadwerkelijke vorm van de echte Anthropic/
// Voyage-API's. Draaien NIET bij elke push (kosten echte tokens, echte netwerkaanroepen),
// alleen als RUN_CONTRACT_TESTS=true staat, wat de nightly-CI-job expliciet aanzet. Als een
// van deze API's ooit hun vorm wijzigt, valt dat hier op vóórdat de mock stilletjes uit de
// pas gaat lopen met de werkelijkheid.
const shouldRun = process.env.RUN_CONTRACT_TESTS === 'true'

describe.skipIf(!shouldRun)('contract: Anthropic /v1/messages', () => {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  it('niet-streaming respons heeft de verwachte vorm', async () => {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Zeg alleen: ok' }],
    })
    expect(res).toHaveProperty('id')
    expect(res).toHaveProperty('type', 'message')
    expect(res).toHaveProperty('role', 'assistant')
    expect(Array.isArray(res.content)).toBe(true)
    expect(res.content[0]).toHaveProperty('type', 'text')
    expect(res.content[0]).toHaveProperty('text')
    expect(res).toHaveProperty('stop_reason')
    expect(res.usage).toHaveProperty('input_tokens')
    expect(res.usage).toHaveProperty('output_tokens')
  })

  it('streaming respons genereert de verwachte SSE-eventtypes', async () => {
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Zeg alleen: ok' }],
    })
    const eventTypes = new Set<string>()
    for await (const event of stream) {
      eventTypes.add(event.type)
      if (event.type === 'content_block_delta') {
        expect(event.delta).toHaveProperty('type', 'text_delta')
        expect(event.delta).toHaveProperty('text')
      }
    }
    expect(eventTypes.has('message_start')).toBe(true)
    expect(eventTypes.has('content_block_delta')).toBe(true)
    expect(eventTypes.has('message_stop')).toBe(true)
  })
})

describe.skipIf(!shouldRun)('contract: Voyage /v1/embeddings en /v1/rerank', () => {
  it('embeddings-respons heeft de verwachte vorm', async () => {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({ input: ['test'], model: 'voyage-3-large' }),
    })
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(Array.isArray(json.data[0].embedding)).toBe(true)
  })

  it('rerank-respons heeft de verwachte vorm', async () => {
    const res = await fetch('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({ query: 'test', documents: ['a', 'b'], model: 'rerank-2.5', top_k: 2 }),
    })
    expect(res.ok).toBe(true)
    const json = await res.json()
    // Live gevonden (2026-07): Voyage's rerank-API gebruikt tegenwoordig de key "data", niet
    // "results". lib/rag.ts's rerankChunks() heeft hiervoor al een fallback
    // (data?.results ?? data?.data), dus productiecode werkt, maar deze test en de mock-
    // server (e2e/mocks/mockVoyageServer.ts) gingen uit van de verouderde vorm. Beide
    // gecorrigeerd naar wat de API nu daadwerkelijk teruggeeft.
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data[0]).toHaveProperty('index')
    expect(json.data[0]).toHaveProperty('relevance_score')
  })
})
