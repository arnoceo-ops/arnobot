import { describe, it, expect, vi } from 'vitest'
import type { MiddlewareContext } from '@anthropic-ai/sdk'
import {
  AI_HEADER_BRON, AI_HEADER_GEBRUIKER, AI_ONBEKENDE_BRON, aiContext, aiKostenUsd, maakAiMeter, maakAiTeller, verwerkStreamEvent, verwerkUsage,
  type AiGebruikRij,
} from './aiGebruik'

describe('kosten', () => {
  it('rekent Sonnet 4.6 tegen $3 en $15, cache schrijven 1,25x en cache lezen 0,1x', () => {
    const k = aiKostenUsd('claude-sonnet-4-6', { invoer: 1_000_000, cache_schrijven: 1_000_000, cache_lezen: 1_000_000, uitvoer: 1_000_000 })
    expect(k).toBeCloseTo(3 + 3.75 + 0.3 + 15, 6)
  })
  it('rekent Haiku 4.5 en Fable 5.1 tegen hun eigen tarief', () => {
    expect(aiKostenUsd('claude-haiku-4-5-20251001', { invoer: 1_000_000, cache_schrijven: 0, cache_lezen: 0, uitvoer: 1_000_000 })).toBeCloseTo(6, 6)
    expect(aiKostenUsd('claude-fable-5-1', { invoer: 1_000_000, cache_schrijven: 0, cache_lezen: 0, uitvoer: 1_000_000 })).toBeCloseTo(60, 6)
  })
  it('geeft null voor een model zonder bekende prijs, zodat het opvalt in plaats van als nul te tellen', () => {
    expect(aiKostenUsd('claude-iets-nieuws', { invoer: 5, cache_schrijven: 0, cache_lezen: 0, uitvoer: 5 })).toBeNull()
    expect(aiKostenUsd(null, { invoer: 5, cache_schrijven: 0, cache_lezen: 0, uitvoer: 5 })).toBeNull()
  })
})

describe('aiContext', () => {
  it('zet de bron altijd en de gebruiker alleen als die er is', () => {
    expect(aiContext('user_a', 'sparring-chat').headers).toEqual({ [AI_HEADER_BRON]: 'sparring-chat', [AI_HEADER_GEBRUIKER]: 'user_a' })
    expect(aiContext(null, 'cron-x').headers).toEqual({ [AI_HEADER_BRON]: 'cron-x' })
  })
})

describe('stroomgebeurtenissen', () => {
  it('neemt model en invoer uit message_start en de eindstand van de uitvoer uit message_delta', () => {
    const t = maakAiTeller()
    verwerkStreamEvent(t, { type: 'message_start', message: { model: 'claude-sonnet-4-6', usage: { input_tokens: 100, cache_read_input_tokens: 40, cache_creation_input_tokens: 10, output_tokens: 1 } } })
    verwerkStreamEvent(t, { type: 'content_block_delta' })
    verwerkStreamEvent(t, { type: 'message_delta', usage: { output_tokens: 20 } })
    verwerkStreamEvent(t, { type: 'message_delta', usage: { output_tokens: 55 } })
    expect(t.model).toBe('claude-sonnet-4-6')
    expect(t.tokens).toEqual({ invoer: 100, cache_schrijven: 10, cache_lezen: 40, uitvoer: 55 })
  })
  it('negeert rommel zonder te falen', () => {
    const t = maakAiTeller()
    verwerkStreamEvent(t, null)
    verwerkStreamEvent(t, 'tekst')
    verwerkStreamEvent(t, { type: 'message_start' })
    verwerkUsage(t.tokens, undefined)
    expect(t.tokens).toEqual({ invoer: 0, cache_schrijven: 0, cache_lezen: 0, uitvoer: 0 })
  })
})

function nepRespons(ok = true): Response {
  return new Response('{}', { status: ok ? 200 : 529 })
}

function nepCtx(opties: { path?: string; stream?: boolean }, parsed: unknown): MiddlewareContext {
  return { options: opties, logger: console, parse: async () => parsed } as unknown as MiddlewareContext
}

function aanroep(url = 'https://api.anthropic.com/v1/messages', headers: Record<string, string> = {}) {
  return { url, method: 'POST', headers: new Headers(headers) } as unknown as Parameters<ReturnType<typeof maakAiMeter>>[0]
}

async function* events(...lijst: unknown[]) { for (const e of lijst) yield e }

describe('middleware', () => {
  it('schrijft één rij met gebruiker, bron en kosten voor een gewone aanroep, en haalt de interne headers van het verzoek', async () => {
    const rijen: AiGebruikRij[] = []
    const taken: Promise<unknown>[] = []
    const mw = maakAiMeter(r => { rijen.push(r) }, t => taken.push(t))
    let gezien: Headers | null = null
    const next = vi.fn(async (req: { headers: Headers }) => { gezien = req.headers; return nepRespons() })
    const ctx = nepCtx({ path: '/v1/messages', stream: false }, { model: 'claude-haiku-4-5-20251001', usage: { input_tokens: 2000, output_tokens: 500 } })
    const res = await mw(aanroep(undefined, { [AI_HEADER_GEBRUIKER]: 'user_a', [AI_HEADER_BRON]: 'sessie-samenvatting', 'x-api-key': 'geheim' }), next as never, ctx)
    await Promise.all(taken)
    expect(res.ok).toBe(true)
    expect(gezien!.get(AI_HEADER_GEBRUIKER)).toBeNull()
    expect(gezien!.get(AI_HEADER_BRON)).toBeNull()
    expect(gezien!.get('x-api-key')).toBe('geheim')
    expect(rijen).toHaveLength(1)
    expect(rijen[0]).toMatchObject({ user_id: 'user_a', bron: 'sessie-samenvatting', model: 'claude-haiku-4-5-20251001', invoer: 2000, uitvoer: 500, afgebroken: false })
    expect(rijen[0].kosten_usd).toBeCloseTo((2000 * 1 + 500 * 5) / 1e6, 8)
  })

  it('meet een stroom en zet een aanroep zonder context op bron onbekend zonder gebruiker', async () => {
    const rijen: AiGebruikRij[] = []
    const taken: Promise<unknown>[] = []
    const mw = maakAiMeter(r => { rijen.push(r) }, t => taken.push(t))
    const stroom = events(
      { type: 'message_start', message: { model: 'claude-sonnet-4-6', usage: { input_tokens: 10, output_tokens: 1 } } },
      { type: 'message_delta', usage: { output_tokens: 42 } },
    )
    await mw(aanroep(), (async () => nepRespons()) as never, nepCtx({ path: '/v1/messages', stream: true }, stroom))
    await Promise.all(taken)
    expect(rijen).toHaveLength(1)
    expect(rijen[0]).toMatchObject({ user_id: null, bron: AI_ONBEKENDE_BRON, invoer: 10, uitvoer: 42 })
  })

  it('bewaart wat bekend was en markeert afgebroken als de stroom halverwege stopt', async () => {
    const rijen: AiGebruikRij[] = []
    const taken: Promise<unknown>[] = []
    const mw = maakAiMeter(r => { rijen.push(r) }, t => taken.push(t))
    async function* kapot() {
      yield { type: 'message_start', message: { model: 'claude-sonnet-4-6', usage: { input_tokens: 500, output_tokens: 1 } } }
      throw new Error('verbinding weg')
    }
    await mw(aanroep(), (async () => nepRespons()) as never, nepCtx({ path: '/v1/messages', stream: true }, kapot()))
    await Promise.all(taken)
    expect(rijen).toHaveLength(1)
    expect(rijen[0]).toMatchObject({ invoer: 500, afgebroken: true })
  })

  it('meet geen mislukte aanroepen en geen andere paden zoals count_tokens', async () => {
    const rijen: AiGebruikRij[] = []
    const taken: Promise<unknown>[] = []
    const mw = maakAiMeter(r => { rijen.push(r) }, t => taken.push(t))
    const data = { model: 'claude-sonnet-4-6', usage: { input_tokens: 1, output_tokens: 1 } }
    await mw(aanroep(), (async () => nepRespons(false)) as never, nepCtx({ path: '/v1/messages' }, data))
    await mw(aanroep(), (async () => nepRespons()) as never, nepCtx({ path: '/v1/messages/count_tokens' }, data))
    await Promise.all(taken)
    expect(rijen).toHaveLength(0)
  })

  it('een fout bij het wegschrijven of in de meting laat de aanroep nooit falen', async () => {
    const taken: Promise<unknown>[] = []
    const mw = maakAiMeter(() => { throw new Error('database weg') }, t => taken.push(t))
    const data = { model: 'claude-sonnet-4-6', usage: { input_tokens: 1, output_tokens: 1 } }
    const res = await mw(aanroep(), (async () => nepRespons()) as never, nepCtx({ path: '/v1/messages' }, data))
    await expect(Promise.all(taken)).resolves.toBeDefined()
    expect(res.ok).toBe(true)
    const ctxKapot = { options: { path: '/v1/messages' }, parse: () => { throw new Error('parse stuk') } } as unknown as MiddlewareContext
    const res2 = await maakAiMeter(() => {}, t => taken.push(t))(aanroep(), (async () => nepRespons()) as never, ctxKapot)
    await Promise.all(taken)
    expect(res2.ok).toBe(true)
  })

  it('schrijft niets als er geen tokens zijn', async () => {
    const rijen: AiGebruikRij[] = []
    const taken: Promise<unknown>[] = []
    const mw = maakAiMeter(r => { rijen.push(r) }, t => taken.push(t))
    await mw(aanroep(), (async () => nepRespons()) as never, nepCtx({ path: '/v1/messages' }, { model: 'claude-sonnet-4-6' }))
    await Promise.all(taken)
    expect(rijen).toHaveLength(0)
  })
})
