import { describe, expect, it } from 'vitest'
import { aantalWoorden, isTeLang, knipOpZin, MAX_WOORDEN } from './uitdagingTekst'

const woorden = (n: number) => Array.from({ length: n }, (_, i) => `woord${i}`).join(' ')

describe('thought of the day, woordgrens', () => {
  it('telt woorden', () => {
    expect(aantalWoorden('Je weet inmiddels hoe het werkt.')).toBe(6)
    expect(aantalWoorden('  ')).toBe(0)
  })
  it('geeft een marge boven het maximum', () => {
    expect(isTeLang(woorden(MAX_WOORDEN))).toBe(false)
    expect(isTeLang(woorden(MAX_WOORDEN + 5))).toBe(false)
    expect(isTeLang(woorden(MAX_WOORDEN + 6))).toBe(true)
  })
  it('knipt terug tot hele zinnen binnen het maximum', () => {
    const tekst = `${woorden(30)}. ${woorden(15)}. ${woorden(20)}.`
    const knip = knipOpZin(tekst)
    expect(aantalWoorden(knip)).toBe(45)
    expect(knip.endsWith('.')).toBe(true)
  })
  it('laat de eerste zin staan als die alleen al te lang is', () => {
    const tekst = `${woorden(70)}. Korte zin.`
    expect(knipOpZin(tekst)).toBe(`${woorden(70)}.`)
  })
  it('laat een korte tekst ongemoeid', () => {
    expect(knipOpZin('Eén zin. Twee zinnen.')).toBe('Eén zin. Twee zinnen.')
  })
})
