import { describe, it, expect, vi, beforeEach } from 'vitest'

// De poort voor API-routes die geld kosten: zonder toegang een 403, de eigenaar en interne testaccounts mogen altijd door.

const { toegang } = vi.hoisted(() => ({ toegang: vi.fn() }))
vi.mock('@/lib/toegangNu', () => ({ heeftToegangNu: toegang }))

const { toegangsWeigering } = await import('./toegangsPoort')
const { MANUAL_TEST_USER_ID, APP_REVIEWER_ID } = await import('./internalTestAccounts')

beforeEach(() => {
  toegang.mockReset()
  delete process.env.ARNOBOT_OWNER_USER_ID
})

describe('toegangsWeigering', () => {
  it('geeft een 403 geen_toegang aan iemand zonder toegang, met de meegegeven headers', async () => {
    toegang.mockResolvedValue(false)
    const res = await toegangsWeigering('u1', { 'x-test': 'ja' })
    expect(res?.status).toBe(403)
    expect(await res!.json()).toEqual({ error: 'geen_toegang' })
    expect(res!.headers.get('x-test')).toBe('ja')
  })
  it('geeft null (doorgaan) aan iemand met toegang', async () => {
    toegang.mockResolvedValue(true)
    expect(await toegangsWeigering('u1')).toBeNull()
  })
  it('laat de eigenaar en de interne testaccounts door zonder de toegang op te zoeken', async () => {
    toegang.mockResolvedValue(false)
    process.env.ARNOBOT_OWNER_USER_ID = 'eigenaar'
    expect(await toegangsWeigering('eigenaar')).toBeNull()
    expect(await toegangsWeigering(MANUAL_TEST_USER_ID)).toBeNull()
    expect(await toegangsWeigering(APP_REVIEWER_ID)).toBeNull()
    expect(toegang).not.toHaveBeenCalled()
  })
  it('is niet ingesteld voor een lege eigenaar-variabele: een gewone gebruiker wordt niet per ongeluk doorgelaten', async () => {
    toegang.mockResolvedValue(false)
    expect((await toegangsWeigering('u1'))?.status).toBe(403)
  })
})
