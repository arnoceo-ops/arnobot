import { describe, it, expect } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { streamRonde, haalWerkruisWeg } from './chatStreamRonde'

type Ev = Anthropic.MessageStreamEvent

const tekstStart = { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } as unknown as Ev
const toolStart = { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 't1', name: 'schrijf_tabel_over', input: {} } } as unknown as Ev
const delta = (text: string) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }) as unknown as Ev

async function* maakStream(events: Ev[]): AsyncIterable<Ev> {
  for (const e of events) yield e
}

async function draai(events: Ev[], houdVast: boolean) {
  const delen: Uint8Array[] = []
  const controller = { enqueue: (d: Uint8Array) => { delen.push(d) } } as unknown as ReadableStreamDefaultController<Uint8Array>
  const uit = await streamRonde(maakStream(events), controller, new TextEncoder(), houdVast)
  return { ...uit, getoond: new TextDecoder().decode(Buffer.concat(delen)) }
}

describe('streamRonde', () => {
  it('gooit tekst vóór een toolaanroep weg en geeft die terug als voorbeeld', async () => {
    const r = await draai([tekstStart, delta('Laat me de meest actuele tabel overschrijven.'), toolStart], true)
    expect(r.getoond).toBe('')
    expect(r.verborgen).toBe(true)
    expect(r.weggegooid).toContain('Laat me de meest actuele tabel')
  })

  it('toont een gewoon antwoord zonder toolaanroep volledig', async () => {
    const r = await draai([tekstStart, delta('Je marge is 47%. '), delta('Wat staat er in je pipeline?')], true)
    expect(r.getoond).toBe('Je marge is 47%. Wat staat er in je pipeline?')
    expect(r.verborgen).toBe(false)
  })

  it('laat een lange tekst alsnog door, ook als er daarna een toolaanroep komt', async () => {
    const lang = 'woord '.repeat(75) + 'einde.'
    const r = await draai([tekstStart, delta(lang), toolStart], true)
    expect(r.getoond).toBe(lang)
    expect(r.verborgen).toBe(false)
  })

  it('streamt direct als er geen hulpmiddelen zijn (houdVast uit)', async () => {
    const r = await draai([tekstStart, delta('Laat me even denken.'), toolStart], false)
    expect(r.getoond).toBe('Laat me even denken.')
    expect(r.verborgen).toBe(false)
  })

  it('negeert tekst na de toolaanroep in dezelfde ronde als de ronde is weggegooid', async () => {
    const r = await draai([tekstStart, delta('Even kijken.'), toolStart, delta('Rest.')], true)
    expect(r.getoond).toBe('')
    expect(r.verborgen).toBe(true)
  })
})

describe('haalWerkruisWeg', () => {
  it('haalt de aanhef weg die de tabelcontrole van 20-11 liet zien', () => {
    expect(haalWerkruisWeg('Goed. De tabel staat goed en de berekening klopt met wat we al hadden.\n\nJouw 10% doel is €2.361.326.')).toBe('Jouw 10% doel is €2.361.326.')
    expect(haalWerkruisWeg('Laat me de tabel eerst goed overschrijven.\n\nDie twee dingen staan los van elkaar.')).toBe('Die twee dingen staan los van elkaar.')
  })
  it('laat inhoud met rust, ook als het over de tabel gaat', () => {
    const t = 'In de tabel staat Jessica op 47,0% marge. Dat is hoog.'
    expect(haalWerkruisWeg(t)).toBe(t)
    expect(haalWerkruisWeg('Je marge is 47%. Laat me weten wat je vindt.')).toBe('Je marge is 47%. Laat me weten wat je vindt.')
  })
  it('schrapt alleen aan het begin, niet midden in het antwoord', () => {
    const t = 'Je zit op 11% groei. De tabel klopt, zeg dit rustig.'
    expect(haalWerkruisWeg(t)).toBe(t)
  })
})

describe('streamRonde met werkruis na een hulpmiddel', () => {
  it('toont het antwoord zonder de aanhef over de tabel', async () => {
    const r = await draai([tekstStart, delta('Goed. De tabel staat goed en de berekening klopt. '), delta('Je doel is €2.361.326.')], true)
    expect(r.getoond).toBe('Je doel is €2.361.326.')
  })
})
