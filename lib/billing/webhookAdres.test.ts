import { describe, expect, it } from 'vitest'
import { webhookAdres } from './mollie'

const PRODUCTIE = 'https://www.arno.bot/api/webhooks/mollie'

describe('webhook-adres', () => {
  it('met een test_-sleutel en een testadres gaat het naar het testadres', () => {
    expect(webhookAdres('test_abc', 'https://voorbeeld.test/hook')).toBe('https://voorbeeld.test/hook')
  })
  it('met een live_-sleutel of zonder sleutel nooit, ook niet als het testadres gezet is', () => {
    expect(webhookAdres('live_abc', 'https://voorbeeld.test/hook')).toBe(PRODUCTIE)
    expect(webhookAdres(undefined, 'https://voorbeeld.test/hook')).toBe(PRODUCTIE)
  })
  it('zonder testadres verandert er niets', () => {
    expect(webhookAdres('test_abc', undefined)).toBe(PRODUCTIE)
    expect(webhookAdres('test_abc', '')).toBe(PRODUCTIE)
  })
})
