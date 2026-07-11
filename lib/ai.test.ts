import { describe, it, expect } from 'vitest'
import { stripDashPunctuation, StreamingDashSanitizer } from './ai'

describe('stripDashPunctuation', () => {
  it('vervangt een los koppelteken met spaties eromheen door een komma', () => {
    expect(stripDashPunctuation('Laten we teruggaan naar je business - waar wil je heen?'))
      .toBe('Laten we teruggaan naar je business, waar wil je heen?')
  })

  it('vervangt een em/en-dash ook zonder spaties eromheen', () => {
    expect(stripDashPunctuation('dat is goed—toch knap')).toBe('dat is goed, toch knap')
  })

  it('laat een koppelteken in een samengesteld woord staan', () => {
    expect(stripDashPunctuation('MT-lid en oud-klant en follow-up blijven staan'))
      .toBe('MT-lid en oud-klant en follow-up blijven staan')
  })

  it('verwijdert een streepje vlak vóór een nieuwe regel zonder de regeleinden op te eten', () => {
    expect(stripDashPunctuation('Wees specifiek -\n\nAANDACHTSPUNT\nHet groeithema.'))
      .toBe('Wees specifiek\n\nAANDACHTSPUNT\nHet groeithema.')
  })

  it('verwijdert liggende streepjes aan het begin van een regel (lijstjes)', () => {
    expect(stripDashPunctuation('Doe dit:\n- Bel de klant\n- Stuur de offerte'))
      .toBe('Doe dit:\nBel de klant\nStuur de offerte')
  })
})

describe('StreamingDashSanitizer', () => {
  const cases = [
    'Laten we teruggaan naar je business - waar willen jij en je klanten naartoe?',
    'dat is goed—toch knap, MT-lid weet dat ook',
    'Wees specifiek, geen lege complimenten -\n\nAANDACHTSPUNT\nHet voornaamste groeithema.',
    'Doe dit:\n- Bel de klant\n- Stuur de offerte',
    'Herhaal: veel korte woordjes af en toe een - en dan weer verder en - nog een keer - test.',
    'eindigt op een dash -',
    'eindigt op een dash gevolgd door spatie - ',
    'follow-up en MT-lid en oud-klant blijven gewoon staan zonder komma',
  ]

  function simulateStreaming(fullText: string, deltaSize: number) {
    const sanitizer = new StreamingDashSanitizer()
    let out = ''
    for (let i = 0; i < fullText.length; i += deltaSize) {
      out += sanitizer.push(fullText.slice(i, i + deltaSize))
    }
    out += sanitizer.flush()
    return out
  }

  // Simuleert dat streaming-tekst in willekeurig kleine brokjes binnenkomt (zoals Anthropic's
  // events dat echt doen) en dat het resultaat, na sanitizen per brokje, exact gelijk moet zijn
  // aan het resultaat van stripDashPunctuation op de complete tekst in één keer. Dit is precies
  // het scenario waarin de oude vaste-lookback-buffer een echte streepje-lek had (live gevonden,
  // 2026-07): een spatie vlak vóór een streepje werd soms al verstuurd vóórdat bekend was of er
  // een streepje volgde.
  for (const deltaSize of [1, 2, 3, 5, 7, 11]) {
    it(`geeft exact hetzelfde resultaat als stripDashPunctuation bij delta-grootte ${deltaSize}`, () => {
      for (const c of cases) {
        expect(simulateStreaming(c, deltaSize)).toBe(stripDashPunctuation(c))
      }
    })
  }

  it('verwerkt tekst zonder streepjes praktisch direct (geen kunstmatige vertraging)', () => {
    const sanitizer = new StreamingDashSanitizer()
    const out = sanitizer.push('Dit is een zin zonder enig streepje erin.')
    // Zonder streepje in de buurt hoeft er niets achtergehouden te worden.
    expect(out).toBe('Dit is een zin zonder enig streepje erin.')
  })
})
