// Draait de echte Anthropic-SDK (versie uit package.json) tegen een nep-API op localhost: geen netwerk naar buiten, geen kosten.
// Bewijst wat de unittests met losse nepobjecten niet kunnen: dat de middleware echt een stroom en een gewone respons leest, dat de
// interne headers niet naar Anthropic gaan en dat de client zelf nog gewoon bruikbare uitvoer krijgt.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import Anthropic from '@anthropic-ai/sdk'
import { AI_HEADER_BRON, AI_HEADER_GEBRUIKER, aiContext, maakAiMeter, type AiGebruikRij } from './aiGebruik'

let server: http.Server
let baseURL = ''
const ontvangenHeaders: http.IncomingHttpHeaders[] = []

const BERICHT = { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6', content: [{ type: 'text', text: 'hallo' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 120, output_tokens: 30, cache_creation_input_tokens: 0, cache_read_input_tokens: 80 } }

const sse = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify({ type, ...(data as object) })}\n\n`

beforeAll(async () => {
  server = http.createServer((req, res) => {
    ontvangenHeaders.push(req.headers)
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      const stream = JSON.parse(body || '{}').stream === true
      if (!stream) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(BERICHT))
        return
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write(sse('message_start', { message: { ...BERICHT, content: [], usage: { input_tokens: 200, cache_read_input_tokens: 50, cache_creation_input_tokens: 10, output_tokens: 1 } } }))
      res.write(sse('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }))
      res.write(sse('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'hoi' } }))
      res.write(sse('content_block_stop', { index: 0 }))
      res.write(sse('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 77 } }))
      res.end(sse('message_stop', {}))
    })
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => { server.close() })

function maakClient() {
  const rijen: AiGebruikRij[] = []
  const taken: Promise<unknown>[] = []
  const client = new Anthropic({ apiKey: 'test', baseURL, maxRetries: 0, middleware: [maakAiMeter(r => { rijen.push(r) }, t => taken.push(t))] })
  return { client, rijen, taken }
}

describe('echte SDK tegen een nep-API', () => {
  it('meet een gewone aanroep per gebruiker en bron, en stuurt onze headers niet door', async () => {
    const { client, rijen, taken } = maakClient()
    const antwoord = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] }, aiContext('user_a', 'test-bron'))
    await Promise.all(taken)
    expect(antwoord.content[0]).toMatchObject({ type: 'text', text: 'hallo' })
    expect(rijen).toHaveLength(1)
    expect(rijen[0]).toMatchObject({ user_id: 'user_a', bron: 'test-bron', model: 'claude-sonnet-4-6', invoer: 120, cache_lezen: 80, uitvoer: 30, afgebroken: false })
    const laatste = ontvangenHeaders.at(-1)!
    expect(laatste[AI_HEADER_GEBRUIKER]).toBeUndefined()
    expect(laatste[AI_HEADER_BRON]).toBeUndefined()
  })

  it('meet een stroom via messages.stream en de client krijgt nog steeds het volledige bericht', async () => {
    const { client, rijen, taken } = maakClient()
    const stroom = client.messages.stream({ model: 'claude-sonnet-4-6', max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] }, aiContext('user_b', 'stroom-bron'))
    const eind = await stroom.finalMessage()
    await Promise.all(taken)
    expect(eind.content[0]).toMatchObject({ type: 'text', text: 'hoi' })
    expect(eind.usage.output_tokens).toBe(77)
    expect(rijen).toHaveLength(1)
    expect(rijen[0]).toMatchObject({ user_id: 'user_b', bron: 'stroom-bron', invoer: 200, cache_schrijven: 10, cache_lezen: 50, uitvoer: 77 })
  })

  it('meet ook zonder context, dan zonder gebruiker', async () => {
    const { client, rijen, taken } = maakClient()
    await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] })
    await Promise.all(taken)
    expect(rijen[0]).toMatchObject({ user_id: null, bron: 'onbekend' })
  })
})
