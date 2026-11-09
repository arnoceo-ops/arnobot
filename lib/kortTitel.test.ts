import { describe, it, expect } from 'vitest'
import { kortTitel } from './kortTitel'

describe('kortTitel', () => {
  it('laat een korte titel ongewijzigd', () => {
    expect(kortTitel('Wat is de beste closing techniek?')).toBe('Wat is de beste closing techniek?')
  })
  it('knipt een afgekapte titel bij het laatste hele woord en voegt puntjes toe', () => {
    const afgekapt = 'Wanneer levert een abonnement op ArnoBot jou als salesbaas concreet iets op, en wat krijg je er prec'
    expect(afgekapt.length).toBe(100)
    expect(kortTitel(afgekapt)).toBe('Wanneer levert een abonnement op ArnoBot jou als salesbaas concreet iets op, en wat krijg je er…')
  })
  it('haalt een komma voor de puntjes weg', () => {
    const t = 'a'.repeat(94) + ' bijv,' + ' xxxx'
    expect(kortTitel(t.slice(0, 100)).endsWith(',…')).toBe(false)
  })
  it('knipt een lang woord zonder spaties toch af met puntjes', () => {
    expect(kortTitel('a'.repeat(100))).toBe('a'.repeat(100) + '…')
  })
  it('kan met leeg of ontbrekend om', () => {
    expect(kortTitel(undefined)).toBe('')
    expect(kortTitel(null)).toBe('')
  })
})
