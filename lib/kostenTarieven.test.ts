import { describe, expect, it } from 'vitest'
import { DEFAULT_INPUTS, computeScenarioKosten, resendOverageUsd, voyageKostenPerBericht, TARIEVEN } from './kostenTarieven'

describe('Resend in Abacus', () => {
  it('geen overschrijding onder de 50.000 inbegrepen mails', () => {
    expect(resendOverageUsd(8000, 6, true)).toBe(0)
  })

  it('rekent boven de 50.000 mails $0,90 per 1.000', () => {
    // 10.000 gebruikers x 6 mails = 60.000, overschot 10.000 = 10 x $0,90
    expect(resendOverageUsd(10000, 6, true)).toBeCloseTo(9, 5)
  })

  it('zonder Pro geen overschrijding: het gratis plan weigert mails', () => {
    expect(resendOverageUsd(1_000_000, 6, false)).toBe(0)
  })

  it('Pro telt als vaste maandpost mee wanneer actief', () => {
    expect(TARIEVEN.resendProUsd).toBe(20)
    const met = computeScenarioKosten({ ...DEFAULT_INPUTS, resendPro: true }, 10, 10)
    const zonder = computeScenarioKosten({ ...DEFAULT_INPUTS, resendPro: false }, 10, 10)
    expect(met.vastKosten - zonder.vastKosten).toBeCloseTo(TARIEVEN.resendProUsd, 5)
  })
})

describe('Voyage rerank in Abacus', () => {
  it('rekent 300.000 tokens tegen $0,05 per 1M: $0,015 per bericht', () => {
    expect(voyageKostenPerBericht()).toBeCloseTo(0.015, 6)
  })

  it('telt mee in het totaal, per bericht van alle gebruikers', () => {
    const r = computeScenarioKosten(DEFAULT_INPUTS, 10, 10)
    expect(r.voyageKosten).toBeCloseTo(20 * DEFAULT_INPUTS.berichten * 0.015, 6)
    const nul = computeScenarioKosten({ ...DEFAULT_INPUTS, voyagePerBericht: 0 }, 10, 10)
    expect(r.totaal - nul.totaal).toBeCloseTo(r.voyageKosten, 6)
  })
})

describe('Documenten en profielimport in Abacus', () => {
  it('een document kost per beurt het hele bestand opnieuw: 40.000 tokens x 5 beurten x 1,3 x $3 per 1M', () => {
    const i = { ...DEFAULT_INPUTS, pctDocumentGebruikers: 100, documentenPerGebruiker: 1, pctDocumentenBewaard: 0, pctHistorieImport: 0 }
    const r = computeScenarioKosten(i, 5, 5)
    expect(r.documentBeurtKosten).toBeCloseTo(10 * 40000 * 5 * 1.3 * 3 / 1e6, 6)
    expect(r.samenvattingKosten).toBe(0)
  })

  it('samenvatting per bewaard document: invoer van het document plus 600 uitvoertokens', () => {
    const i = { ...DEFAULT_INPUTS, pctDocumentGebruikers: 100, documentenPerGebruiker: 1, pctDocumentenBewaard: 100 }
    const r = computeScenarioKosten(i, 5, 5)
    expect(r.samenvattingKosten).toBeCloseTo(10 * (40000 * 3 + 600 * 15) / 1e6, 6)
  })

  it('telt mee in het totaal en staat op nul als niemand het gebruikt', () => {
    const uit = { ...DEFAULT_INPUTS, pctDocumentGebruikers: 0, pctHistorieImport: 0 }
    const r0 = computeScenarioKosten(uit, 10, 10)
    expect(r0.documentKosten).toBe(0)
    expect(r0.historieImportKosten).toBe(0)
    const r = computeScenarioKosten(DEFAULT_INPUTS, 10, 10)
    expect(r.totaal - r0.totaal).toBeCloseTo(r.documentKosten + r.historieImportKosten, 6)
  })

  it('profielimport: eenmalige omzetting plus 2.000 tokens bij elk bericht', () => {
    const i = { ...DEFAULT_INPUTS, pctDocumentGebruikers: 0, pctHistorieImport: 100 }
    const r = computeScenarioKosten(i, 5, 5)
    expect(r.historieImportKosten).toBeCloseTo(10 * (0.02 + 60 * 2000 * 3 / 1e6), 6)
  })
})

describe('gesprekken afsluiten', () => {
  it('beweegt mee met het aantal vragen en telt ook voor Basic', () => {
    const i = { ...DEFAULT_INPUTS, berichten: 44, vragenPerGesprek: 4.4, afsluitKostenPerGesprek: 0.1 }
    expect(computeScenarioKosten(i, 10, 0).afsluitKosten).toBeCloseTo(10, 6)
    expect(computeScenarioKosten({ ...i, berichten: 88 }, 10, 0).afsluitKosten).toBeCloseTo(20, 6)
    expect(computeScenarioKosten({ ...i, vragenPerGesprek: 0 }, 10, 0).afsluitKosten).toBe(0)
  })
})
