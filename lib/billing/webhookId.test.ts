import { describe, expect, it } from 'vitest'
import { leesRijHint, leesWebhookId } from './webhookId'

describe('leesWebhookId', () => {
  it('leest een klassieke formulierbody met een betaling', () => {
    expect(leesWebhookId('id=tr_WDqYK6vllg')).toBe('tr_WDqYK6vllg')
  })

  it('leest een betaallink-id uit een formulierbody', () => {
    expect(leesWebhookId('id=pl_7MVV79D7UYPSuwCEwEKga')).toBe('pl_7MVV79D7UYPSuwCEwEKga')
  })

  it('leest bij next-gen JSON het entityId, niet het event-id', () => {
    const body = JSON.stringify({ resource: 'event', id: 'event_abc123XYZ', type: 'payment-link.paid', entityId: 'pl_7MVV79D7UYPSuwCEwEKga' })
    expect(leesWebhookId(body)).toBe('pl_7MVV79D7UYPSuwCEwEKga')
  })

  it('weigert vreemde ids, lege en kapotte bodies', () => {
    expect(leesWebhookId('')).toBeNull()
    expect(leesWebhookId('id=sub_abc12345')).toBeNull()
    expect(leesWebhookId('id=tr_x')).toBeNull()
    expect(leesWebhookId('id=tr_../../etc')).toBeNull()
    expect(leesWebhookId('{kapot')).toBeNull()
    expect(leesWebhookId('null')).toBeNull()
    expect(leesWebhookId(JSON.stringify({ id: 'event_abc123XYZ' }))).toBeNull()
  })
})

describe('leesRijHint', () => {
  it('accepteert alleen een uuid', () => {
    expect(leesRijHint('d0697e08-b5e8-476a-bdb1-3156523bed9a')).toBe('d0697e08-b5e8-476a-bdb1-3156523bed9a')
    expect(leesRijHint(null)).toBeNull()
    expect(leesRijHint('')).toBeNull()
    expect(leesRijHint("1' or '1'='1")).toBeNull()
    expect(leesRijHint('d0697e08-b5e8-476a-bdb1-3156523bed9a/../x')).toBeNull()
  })
})
