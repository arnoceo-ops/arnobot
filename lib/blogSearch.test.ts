import { describe, it, expect } from 'vitest'
import { filterPosts } from './blogSearch'

const posts = [
  { title: 'Zo gebruik je sparren', summary: 'Oefenen met weerstand', tags: ['sparren', 'coaching'] },
  { title: 'Wat je met coaching kunt', summary: 'Patronen in gesprekken', tags: ['coaching'] },
  { title: 'Teams en 1:1 gesprekken', summary: 'Voor managers', tags: ['teams'] },
  { title: 'Café gesprekken', summary: 'Accenten testen', tags: ['cafe'] },
]
const titels = (q: string) => filterPosts(posts, q).map(p => p.title)

describe('filterPosts', () => {
  it('geeft alles bij een lege zoekterm', () => {
    expect(filterPosts(posts, '')).toHaveLength(4)
    expect(filterPosts(posts, '   ')).toHaveLength(4)
    expect(filterPosts(posts, '#')).toHaveLength(4)
  })

  it('zoekt op hashtag met en zonder #', () => {
    expect(titels('#coaching')).toEqual(['Zo gebruik je sparren', 'Wat je met coaching kunt'])
    expect(titels('#teams')).toEqual(['Teams en 1:1 gesprekken'])
  })

  it('matcht het begin van een hashtag tijdens het typen', () => {
    expect(titels('#spar')).toEqual(['Zo gebruik je sparren'])
    expect(titels('#ing')).toEqual([])
  })

  it('zoekt zonder # in titel, samenvatting en hashtags', () => {
    expect(titels('weerstand')).toEqual(['Zo gebruik je sparren'])
    expect(titels('managers')).toEqual(['Teams en 1:1 gesprekken'])
    expect(titels('coaching')).toHaveLength(2)
  })

  it('vereist dat alle woorden kloppen', () => {
    expect(titels('coaching patronen')).toEqual(['Wat je met coaching kunt'])
    expect(titels('#coaching #sparren')).toEqual(['Zo gebruik je sparren'])
    expect(titels('#coaching teams')).toEqual([])
  })

  it('negeert hoofdletters en accenten', () => {
    expect(titels('CAFE')).toEqual(['Café gesprekken'])
    expect(titels('café')).toEqual(['Café gesprekken'])
    expect(titels('#CAFÉ')).toEqual(['Café gesprekken'])
  })

  it('geeft niets terug bij een onbekende term', () => {
    expect(titels('onbekendewoord')).toEqual([])
  })
})
