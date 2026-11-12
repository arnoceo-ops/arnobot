import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MollieError, klantBestaat, maakKlant } from '@/lib/billing/mollie'

// Een bewaarde Mollie-klant die in de huidige modus niet bestaat (betaald onder een andere sleutel of in livemodus)
// mag het afrekenen niet laten mislukken: de checkout controleert hem eerst en maakt zo nodig een nieuwe.

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubEnv('MOLLIE_API_KEY', 'test_abc')
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { fetchMock.mockReset(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

const antwoord = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status })

describe('klantBestaat', () => {
  it('true als Mollie de klant kent', async () => {
    fetchMock.mockResolvedValue(antwoord(200, { id: 'cst_abc' }))
    expect(await klantBestaat('cst_abc')).toBe(true)
  })

  it.each([404, 410])('false bij %s (klant onbekend in deze modus)', async status => {
    fetchMock.mockResolvedValue(antwoord(status, { detail: 'No customer exists with token cst_abc.' }))
    expect(await klantBestaat('cst_abc')).toBe(false)
  })

  it('gooit door bij andere fouten: dan weten we het niet en maken we geen dubbele klant', async () => {
    fetchMock.mockResolvedValue(antwoord(500, { detail: 'kapot' }))
    await expect(klantBestaat('cst_abc')).rejects.toBeInstanceOf(MollieError)
    fetchMock.mockResolvedValue(antwoord(401, { detail: 'Invalid key' }))
    await expect(klantBestaat('cst_abc')).rejects.toBeInstanceOf(MollieError)
  })

  it('false voor een ongeldig id, zonder Mollie te bevragen', async () => {
    expect(await klantBestaat('../x')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('maakKlant idempotency-key', () => {
  const sleutel = async (vervangt?: string) => {
    fetchMock.mockResolvedValue(antwoord(201, { id: 'cst_nieuw' }))
    await maakKlant({ naam: 'N', email: 'a@b.c', userId: 'user_1', vervangt })
    return (fetchMock.mock.calls.at(-1)![1].headers as Record<string, string>)['Idempotency-Key']
  }

  it('standaard één vaste sleutel per gebruiker', async () => {
    expect(await sleutel()).toBe('klant-user_1')
  })

  it('bij het vervangen van een onbekende klant een andere sleutel, anders geeft Mollie de oude respons terug', async () => {
    expect(await sleutel('cst_oud')).toBe('klant-user_1-na-cst_oud')
  })
})
