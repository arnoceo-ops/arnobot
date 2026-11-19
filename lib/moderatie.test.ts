import { describe, it, expect } from 'vitest'
import { bouwAppModeratiePrompt, GRENSGEVAL_INSTRUCTIE } from './moderatie'

describe('bouwAppModeratiePrompt', () => {
  const prompt = bouwAppModeratiePrompt('', 'Een vraag', 'toon', 'ernst')
  it('kent vier oordelen en laat bij OK en GRENSGEVAL de tweede regel weg', () => {
    for (const w of ['ONGEPAST:', 'OFFTOPIC:', 'GRENSGEVAL:', 'OK:']) expect(prompt).toContain(w)
    expect(prompt).toContain('Bij OK en bij GRENSGEVAL schrijf je geen tweede regel.')
    expect(prompt).toContain('alleen als het ONGEPAST of OFFTOPIC is')
  })
  it('houdt een algemene vraag zonder koppeling aan het werk off-topic', () => {
    expect(prompt).toContain('Een algemene vraag over zo\'n onderwerp, zonder koppeling aan zijn werk, is OFFTOPIC')
  })
  it('rekent gewone coachingsvragen over energie, planning en gewoontes tot OK', () => {
    expect(prompt).toMatch(/OK: logisch vervolg[^\n]*energie, planning, gewoontes of prestaties/)
  })
  it('rekent vragen over ArnoBot zelf, uploads, archief en links tot OK en kiest bij twijfel OK', () => {
    expect(prompt).toMatch(/OK: logisch vervolg[^\n]*ArnoBot zelf[^\n]*uploads, bestanden, archief[^\n]*gedeelde link/)
    expect(prompt).toContain('NOOIT OFFTOPIC en NOOIT ONGEPAST')
    expect(prompt).toContain('kies dan OK')
  })
  it('zet de vraag en het gesprek erin', () => {
    expect(bouwAppModeratiePrompt('GEBRUIKER: hoi', 'Mijn vraag', 't', 'o')).toContain('Nieuwste bericht van de gebruiker: "Mijn vraag"')
  })
})

describe('GRENSGEVAL_INSTRUCTIE', () => {
  it('is eerlijk over wat ArnoBot niet kan: niet zelf zoeken en geen actuele standen berekenen', () => {
    expect(GRENSGEVAL_INSTRUCTIE).toContain('je kunt niet zelf op het web zoeken')
    expect(GRENSGEVAL_INSTRUCTIE).toContain('geen actuele stand')
  })
  it('vraagt of de gebruiker wil dat hij meedenkt of een bron deelt, en leert de gebruiker kennen', () => {
    expect(GRENSGEVAL_INSTRUCTIE).toContain('een bron of link deelt')
    expect(GRENSGEVAL_INSTRUCTIE).toContain('hoe de gebruiker plant en beslist')
  })
  it('bevat geen streepjes als leesteken', () => {
    expect(GRENSGEVAL_INSTRUCTIE).not.toMatch(/[\u2013\u2014]/)
    expect(GRENSGEVAL_INSTRUCTIE).not.toMatch(/\s-\s/)
  })
})
