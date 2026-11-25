import { describe, expect, it } from 'vitest'
import { dienstRaaktOns, isStipCapaciteit, isStipStoring, werkStippenBij, type Stip, type StipStaat } from '@/lib/adminStippen'

const stip = (niveau: Stip['niveau'], extra: Partial<Stip> = {}): Stip => ({ sleutel: 's', naam: 'Mollie', niveau, tekst: 't', ...extra })

/** Speelt een reeks runs af en geeft per run de titels van de meldingen. */
function speel(stippen: Stip[]): string[][] {
  let staat: StipStaat = {}
  return stippen.map(s => {
    const r = werkStippenBij(staat, [s])
    staat = r.staat
    return r.meldingen.map(m => m.titel)
  })
}

describe('werkStippenBij', () => {
  it('meldt oranje één keer, rood als verzwaring, en groen pas na twee schone runs', () => {
    expect(speel([stip('ok'), stip('let-op'), stip('let-op'), stip('fout'), stip('fout'), stip('ok'), stip('ok'), stip('ok')])).toEqual([
      [], ['Oranje: Mollie'], [], ['Rood: Mollie'], [], [], ['Weer groen: Mollie'], [],
    ])
  })

  it('meldt niet opnieuw bij heen en weer springen', () => {
    expect(speel([stip('fout'), stip('let-op'), stip('fout'), stip('ok'), stip('fout')])).toEqual([['Rood: Mollie'], [], [], [], []])
  })

  it('verandert niets bij een mislukte meting', () => {
    expect(speel([stip('fout'), stip('ok'), stip('onbekend'), stip('ok')])).toEqual([['Rood: Mollie'], [], [], ['Weer groen: Mollie']])
  })

  it('houdt oranje stil als de stip dat vraagt, ook bij herstel, maar meldt rood wel', () => {
    const stil = { meldBijOranje: false }
    expect(speel([stip('let-op', stil), stip('ok', stil), stip('ok', stil)])).toEqual([[], [], []])
    expect(speel([stip('let-op', stil), stip('fout', stil)])).toEqual([[], ['Rood: Mollie']])
  })

  it('meldt alsnog als een stille oranje stip later wel iets raakt', () => {
    expect(speel([stip('let-op', { meldBijOranje: false }), stip('let-op')])).toEqual([[], ['Oranje: Mollie']])
  })
})

describe('dienstRaaktOns', () => {
  it('filtert een storing die arno.bot niet raakt', () => {
    expect(dienstRaaktOns('Anthropic', { components: [{ name: 'claude.ai', status: 'degraded_performance' }] })).toBe(false)
    expect(dienstRaaktOns('Anthropic', { components: [{ name: 'Claude API (api.anthropic.com)', status: 'partial_outage' }] })).toBe(true)
    expect(dienstRaaktOns('Anthropic', { incidents: [{ components: [{ name: 'Claude API (api.anthropic.com)' }] }] })).toBe(true)
  })

  it('meldt bij twijfel: geen onderdelen bekend, of geen lijst voor de dienst', () => {
    expect(dienstRaaktOns('Anthropic', { incidents: [{ components: [] }] })).toBe(true)
    expect(dienstRaaktOns('Supabase', { components: [{ name: 'Auth', status: 'degraded_performance' }] })).toBe(true)
  })
})

describe('welke Telegrammeldingen een stip zijn', () => {
  it('laat snelheid, verbindingen en mijlpalen bij Telegram', () => {
    expect(isStipStoring('storing:extern:Vercel')).toBe(true)
    expect(isStipStoring('storing:arnobot:down')).toBe(true)
    expect(isStipStoring('storing:snelheid:laag')).toBe(false)
    expect(isStipCapaciteit('database:kritiek')).toBe(true)
    expect(isStipCapaciteit('database-geheugen:waarschuwing')).toBe(true)
    expect(isStipCapaciteit('database-verbindingen:kritiek')).toBe(false)
    expect(isStipCapaciteit('mijlpaal:50')).toBe(false)
  })
})
