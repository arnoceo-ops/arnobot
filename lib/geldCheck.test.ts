import { describe, it, expect } from 'vitest'
import { getallenIn, voerGeldCheckUit, bouwCheckInvoer, gebruikersTekst, metGeldBlok, doeGeldCheck } from '@/lib/geldCheck'

// Alle bedragen hier zijn verzonnen.
describe('getallenIn', () => {
  it('leest Nederlandse en Engelse notaties en afkortingen', () => {
    const g = getallenIn('300k van 8m, 14,25 per doos, 1.234.567 euro, 7 654 321 en -9% bij 2,5 miljoen')
    for (const n of [300000, 8000000, 14.25, 1234567, 7654321, 9, 2500000]) expect(g).toContain(n)
  })
  it('maakt van "3 maanden" geen miljoenen', () => {
    expect(getallenIn('over 3 maanden')).not.toContain(3000000)
  })
})

describe('voerGeldCheckUit', () => {
  const tekst = 'Contract van 300k, de index is -9% en onze marge is 40%.'

  it('rekent zelf en geeft een blok', () => {
    const r = voerGeldCheckUit({ prijswijziging: [{ omzet: 300000, wijziging_procent: -9, marge_procent: 40 }] }, tekst)
    expect(r.uitgevoerd).toEqual(['prijswijziging'])
    expect(r.blok).toContain('de verlaging doorvoeren kost 27000 marge')
  })

  it('gooit een berekening met een verzonnen getal weg', () => {
    const r = voerGeldCheckUit({ prijswijziging: [{ omzet: 450000, wijziging_procent: -9 }] }, tekst)
    expect(r.blok).toBe('')
    expect(r.afgekeurd[0]).toContain('450000')
  })

  it('het btw-tarief mag een aanname zijn', () => {
    const r = voerGeldCheckUit({ prijzen_vergelijken: [{ btw_procent: 21, btw_procent_bron: 'aanname', prijzen: [
      { naam: 'a', bedrag: 60.5, btw: 'inclusief' }, { naam: 'b', bedrag: 52, btw: 'exclusief' },
    ] }] }, 'zij betalen 60,50 inclusief, wij vragen 52 exclusief')
    expect(r.uitgevoerd).toEqual(['prijzen_vergelijken'])
  })

  it('leeg of kapot geeft niets', () => {
    expect(voerGeldCheckUit(null, tekst).blok).toBe('')
    expect(voerGeldCheckUit({ prijswijziging: [null], deel_van_totaal: 'x' }, tekst).blok).toBe('')
  })
})

describe('hulpfuncties voor de chat', () => {
  it('merkt eerdere antwoorden als geen bron en telt ze niet als tekst van de gebruiker', () => {
    const h = [{ role: 'user', content: 'omzet 300k' }, { role: 'assistant', content: 'dat is 999' }]
    expect(bouwCheckInvoer(h, 'en nu?')).toContain('EERDER ANTWOORD COACH (geen bron):\ndat is 999')
    expect(gebruikersTekst(h, 'en nu?')).not.toContain('999')
  })

  it('zet het blok bij de vraag, ook bij een bijlage', () => {
    expect(metGeldBlok('vraag', '')).toBe('vraag')
    expect(metGeldBlok('vraag', 'som')).toContain('vraag\n\n[Van de app, niet van de gebruiker]\nsom')
    expect(metGeldBlok([{ type: 'text', text: 'vraag' }], 'som')).toHaveLength(2)
  })
})

describe('doeGeldCheck', () => {
  const nep = (stop: string, tekst: string) => ({ messages: { create: async () => ({ stop_reason: stop, content: [{ type: 'text', text: tekst }] }) } }) as never

  it('geldvraag zonder berekening telt als geldvraag', async () => {
    const r = await doeGeldCheck(nep('end_turn', '{"geldvraag":true,"prijswijziging":[],"prijzen_vergelijken":[],"deel_van_totaal":[]}'), [], 'wat vraag ik als salaris?', {})
    expect(r).toMatchObject({ geldvraag: true, blok: '' })
  })

  it('een afgekapt antwoord is een fout', async () => {
    await expect(doeGeldCheck(nep('max_tokens', '{'), [], 'x', {})).rejects.toThrow()
  })
})
