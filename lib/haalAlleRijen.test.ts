import { describe, it, expect } from 'vitest'
import { haalAlleRijen } from './haalAlleRijen'

// Nabootsing van de database: geeft nooit meer dan 1000 rijen terug, net als PostgREST.
function nepTabel(aantal: number, foutBijBlok?: number) {
  const rijen = Array.from({ length: aantal }, (_, i) => ({ id: i }))
  let aanroepen = 0
  const bouw = async (van: number, tot: number) => {
    aanroepen++
    if (foutBijBlok !== undefined && van / 1000 === foutBijBlok) return { data: null, error: { message: 'kapot' } }
    return { data: rijen.slice(van, Math.min(tot + 1, van + 1000)), error: null }
  }
  return { bouw, aanroepen: () => aanroepen }
}

describe('haalAlleRijen', () => {
  it('haalt alles op boven de grens van 1000', async () => {
    const t = nepTabel(2500)
    const uit = await haalAlleRijen(t.bouw)
    expect(uit).toHaveLength(2500)
    expect(uit[0].id).toBe(0)
    expect(uit[2499].id).toBe(2499)
    expect(t.aanroepen()).toBe(3)
  })

  it('werkt bij een exact veelvoud van de blokgrootte', async () => {
    const t = nepTabel(2000)
    expect(await haalAlleRijen(t.bouw)).toHaveLength(2000)
    expect(t.aanroepen()).toBe(3) // 1000, 1000 en een leeg derde blok
  })

  it('werkt bij een lege tabel en bij minder dan een blok', async () => {
    expect(await haalAlleRijen(nepTabel(0).bouw)).toEqual([])
    expect(await haalAlleRijen(nepTabel(7).bouw)).toHaveLength(7)
  })

  it('geeft geen dubbele of ontbrekende rijen', async () => {
    const uit = await haalAlleRijen(nepTabel(3210).bouw)
    expect(new Set(uit.map(r => r.id)).size).toBe(3210)
  })

  it('gooit bij een databasefout in plaats van stil een deel terug te geven', async () => {
    await expect(haalAlleRijen(nepTabel(2500, 1).bouw)).rejects.toThrow(/kapot/)
  })

  it('stopt bij het maximum zodat een fout nooit eindeloos doorloopt', async () => {
    await expect(haalAlleRijen(nepTabel(5000).bouw, { max: 2000 })).rejects.toThrow(/meer dan 2000/)
  })

  it('geeft de juiste bereiken door aan de query', async () => {
    const bereiken: [number, number][] = []
    await haalAlleRijen(async (van, tot) => { bereiken.push([van, tot]); return { data: [], error: null } })
    expect(bereiken).toEqual([[0, 999]])
  })
})
