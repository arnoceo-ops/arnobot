import { describe, expect, it } from 'vitest'
import { kortTitel, metaTitel, paginaKop } from './gesprekTitel'

describe('gesprekTitel', () => {
  it('laat korte titels staan en kapt lange af op een woordgrens', () => {
    expect(kortTitel('Korte titel')).toBe('Korte titel')
    const lang = 'woord '.repeat(30)
    const k = kortTitel(lang, 60)
    expect(k.length).toBeLessThanOrEqual(61)
    expect(k.endsWith('…')).toBe(true)
    expect(k).not.toMatch(/\s…$/)
  })

  it('metaTitel gebruikt onderwerp, valt terug op ingekorte vraag, dan op vaste tekst', () => {
    expect(metaTitel({ onderwerp: 'Functieprofiel voor een junior sales', title: 'x'.repeat(100) })).toBe('Functieprofiel voor een junior sales')
    expect(metaTitel({ onderwerp: null, title: 'woord '.repeat(30) }).length).toBeLessThanOrEqual(61)
    expect(metaTitel({ onderwerp: ' ', title: null })).toBe('Gesprek met ArnoBot')
    expect(metaTitel(null)).toBe('Gesprek met ArnoBot')
  })

  it('paginaKop toont alleen een echt onderwerp, nooit de vraag', () => {
    expect(paginaKop({ onderwerp: 'Functieprofiel junior sales', title: 'vraag' })).toBe('Functieprofiel junior sales')
    expect(paginaKop({ onderwerp: null, title: 'vraag' })).toBeNull()
  })
})
