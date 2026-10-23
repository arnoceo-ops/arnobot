import { describe, it, expect } from 'vitest'
import { agendaVerwijstGoed, buildEenOpEenSystemPrompt } from './teamEenOpEenPrompt'

describe('agendaVerwijstGoed', () => {
  it('accepteert manager als jij en teamlid bij naam', () => {
    const t = 'WAT GAAT GOED\nAlira brengt prijsgesprekken terug naar waarde.\n\nAANDACHTSPUNT\nAlira stelt het exitgesprek uit.\n\nARNO ADVISEERT\nVraag Alira: "Wat houdt je tegen?" Luister goed naar wat je hoort.'
    expect(agendaVerwijstGoed(t)).toBe(true)
  })
  it('weigert je in de teamlid-secties', () => {
    expect(agendaVerwijstGoed('WAT GAAT GOED\nDit raakt je pipeline.\n\nARNO ADVISEERT\nVraag het.')).toBe(false)
  })
  it('weigert hij of zij voor het teamlid', () => {
    expect(agendaVerwijstGoed('WAT GAAT GOED\nAlira doet het goed.\n\nARNO ADVISEERT\nVraag haar waarom.')).toBe(false)
  })
  it('weigert tijdgebonden aanwijzingen maar niet "weken geleden"', () => {
    expect(agendaVerwijstGoed('WAT GAAT GOED\nAlira.\n\nARNO ADVISEERT\nMaak dit volgende week af.')).toBe(false)
    expect(agendaVerwijstGoed('WAT GAAT GOED\nAlira doet het goed.\n\nAANDACHTSPUNT\nDrie weken geleden was dit anders.\n\nARNO ADVISEERT\nVraag Alira: "Wat is er veranderd?"')).toBe(true)
  })
  it('weigert gesprek met Arno erin', () => {
    expect(agendaVerwijstGoed('WAT GAAT GOED\nAlira.\n\nARNO ADVISEERT\nLaten we samen een zin schrijven.')).toBe(false)
  })
})

describe('buildEenOpEenSystemPrompt', () => {
  it('scheidt manager en teamlid en bevat geen streepjes', () => {
    const p = buildEenOpEenSystemPrompt(true, true)
    expect(p).toContain('WIE IS WIE')
    expect(p).toContain('derde persoon')
    // De verbodsregel zelf noemt de tekens, de rest van de prompt mag ze niet bevatten.
    const zonderVerbodsregel = p.split('\n').filter(l => !l.includes('NOOIT een streepje')).join('\n')
    expect(/[—–]/.test(zonderVerbodsregel)).toBe(false)
  })
})
