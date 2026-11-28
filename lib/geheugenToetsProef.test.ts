import { describe, it, expect, vi } from 'vitest'
import { toetsGeheugen, herstelSamenvatting } from '@/lib/geheugenToets'

// Proef voor de eigenaar: de samenvatting wordt tegen het volledige gesprek getoetst, de feiten tegen de ingekorte bron.
const antwoord = (json: object) => ({ content: [{ type: 'text', text: JSON.stringify(json) }] })
const client = (create: ReturnType<typeof vi.fn>) => ({ messages: { create } }) as never
const gesprek = { bron: 'INGEKORTE BRON', summary: 'Een samenvatting.', feiten: 'feit een\nfeit twee' }

describe('geheugentoets', () => {
  it('doet zonder volledig gesprek een enkele aanroep, zoals voorheen', async () => {
    const create = vi.fn().mockResolvedValue(antwoord({ ongedekt: [], samenvatting: [] }))
    await toetsGeheugen(client(create), gesprek)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].messages[0].content).toContain('INGEKORTE BRON')
  })

  it('toetst met volledig gesprek de feiten en de samenvatting apart', async () => {
    const create = vi.fn(async (p: { messages: { content: string }[] }) =>
      p.messages[0].content.includes('HET HELE GESPREK')
        // Een feitnummer uit de samenvattingstoets en een citaat uit de feitentoets tellen niet mee.
        ? antwoord({ ongedekt: [1], samenvatting: ['uit de samenvatting'] })
        : antwoord({ ongedekt: [2], samenvatting: ['uit de feitentoets'] }))
    const t = await toetsGeheugen(client(create as never), { ...gesprek, volledig: 'HET HELE GESPREK' })
    expect(create).toHaveBeenCalledTimes(2)
    expect(t).toEqual({ feiten: 'feit een', vermijd: ['uit de samenvatting'], ingegrepen: true })
  })

  it('past bij gericht herstel de bestaande samenvatting aan en haalt de kop weg', async () => {
    const create = vi.fn().mockResolvedValue(antwoord({ ongedekt: [], samenvatting: [] }))
    const schrijf = vi.fn()
    const pasAan = vi.fn().mockResolvedValue('Samenvatting:\nAangepaste tekst.')
    const uit = await herstelSamenvatting(client(create), {
      volledigGesprek: 'HET HELE GESPREK', bron: 'INGEKORTE BRON', vermijd: ['x'], schrijf,
      gericht: { samenvatting: 'Oude tekst.', pasAan },
    })
    expect(uit).toBe('Aangepaste tekst.')
    expect(pasAan).toHaveBeenCalledWith('Oude tekst.', ['x'])
    expect(schrijf).not.toHaveBeenCalled()
  })
})
