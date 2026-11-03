import { describe, it, expect } from 'vitest'
import { schoonTekst, bepaalVerschil, verschilAlsTekst, hashTekst } from './leveranciersPaginas'

describe('schoonTekst', () => {
  it('haalt scripts, navigatie en footer weg en houdt de inhoud', () => {
    const html = `<nav>Menu</nav><script>var x=1</script><h1>DPA</h1><p>Clausule  een.</p><footer>Voet</footer>`
    expect(schoonTekst(html)).toBe('DPA\nClausule een.')
  })

  it('negeert tellers zoals 114.4K zodat alleen echte wijzigingen overblijven', () => {
    const a = schoonTekst('<p>Community 111.5K leden</p><p>Tekst</p>')
    const b = schoonTekst('<p>Community 114.3K leden</p><p>Tekst</p>')
    expect(hashTekst(a)).toBe(hashTekst(b))
  })
})

describe('bepaalVerschil', () => {
  it('vindt nieuwe en verdwenen regels', () => {
    const v = bepaalVerschil('a\nb\nc', 'a\nc\nd')
    expect(v.toegevoegd).toEqual(['d'])
    expect(v.verwijderd).toEqual(['b'])
  })

  it('geeft niets bij alleen een andere volgorde', () => {
    const v = bepaalVerschil('a\nb', 'b\na')
    expect(v.toegevoegd).toEqual([])
    expect(v.verwijderd).toEqual([])
  })

  it('kort een groot verschil in', () => {
    const v = bepaalVerschil('', Array.from({ length: 500 }, (_, i) => `regel ${i} ${'x'.repeat(100)}`).join('\n'))
    expect(verschilAlsTekst(v, 1000).length).toBeLessThan(1100)
  })
})
