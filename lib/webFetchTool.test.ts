import { describe, it, expect } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { bevatLink, opgehaaldePaginas, metWebFetchPrompt, WEB_FETCH_TOOL, WEB_FETCH_PROMPT } from '@/lib/webFetchTool'
import { getAllText } from '@/lib/ai'

const blok = (b: unknown) => b as Anthropic.Message['content'][number]

describe('bevatLink', () => {
  it('herkent http(s)-adressen, ook midden in een zin', () => {
    expect(bevatLink('Kijk hier eens na:\nhttps://www.ebay.de/itm/316259591195\n\nDit is een prijs')).toBe(true)
    expect(bevatLink('zie http://voorbeeld.nl/pagina?a=1')).toBe(true)
  })
  it('negeert gewone tekst, losse domeinnamen en andere schema\'s', () => {
    expect(bevatLink('Wat denk je van www.voorbeeld.nl?')).toBe(false)
    expect(bevatLink('mail me op iemand@voorbeeld.nl')).toBe(false)
    expect(bevatLink('ftp://voorbeeld.nl/bestand')).toBe(false)
    expect(bevatLink('')).toBe(false)
  })
})

describe('WEB_FETCH_TOOL', () => {
  it('is begrensd: weinig pagina\'s en een tokenplafond', () => {
    expect(WEB_FETCH_TOOL.max_uses).toBeLessThanOrEqual(2)
    expect(WEB_FETCH_TOOL.max_content_tokens).toBeLessThanOrEqual(15000)
  })
  it('de prompt bevat geen streepjes als leesteken', () => {
    expect(WEB_FETCH_PROMPT).not.toMatch(/[–—]/)
  })
})

describe('metWebFetchPrompt', () => {
  const blokken = [
    { type: 'text' as const, text: 'PERSONA', cache_control: { type: 'ephemeral' as const } },
    { type: 'text' as const, text: 'CONTEXT' },
  ]
  it('laat de blokken ongemoeid zonder link', () => {
    expect(metWebFetchPrompt(blokken, false)).toBe(blokken)
  })
  it('voegt met een link de regels als eigen blok achteraan toe en behoudt de persona', () => {
    const uit = metWebFetchPrompt(blokken, true)
    expect(uit).toHaveLength(3)
    expect(uit.slice(0, 2)).toEqual(blokken)
    expect(uit[2].text).toBe(WEB_FETCH_PROMPT)
    expect(JSON.stringify(uit)).not.toContain('[object Object]')
  })
})

describe('opgehaaldePaginas', () => {
  it('geeft tekst van gelukte fetches en de foutcode van mislukte', () => {
    const content = [
      blok({ type: 'text', text: 'Ik kijk even.', citations: null }),
      blok({ type: 'server_tool_use', id: 's1', name: 'web_fetch', input: { url: 'https://a.nl' } }),
      blok({
        type: 'web_fetch_tool_result', tool_use_id: 's1',
        content: { type: 'web_fetch_result', url: 'https://a.nl', retrieved_at: null, content: { type: 'document', title: 'A', citations: null, source: { type: 'text', media_type: 'text/plain', data: 'Paginatekst' } } },
      }),
      blok({ type: 'web_fetch_tool_result', tool_use_id: 's2', content: { type: 'web_fetch_tool_result_error', error_code: 'url_not_accessible' } }),
    ]
    expect(opgehaaldePaginas(content)).toEqual([
      { url: 'https://a.nl', tekst: 'Paginatekst' },
      { url: '(mislukt)', tekst: 'Ophalen mislukt: url_not_accessible' },
    ])
  })
})

describe('getAllText', () => {
  it('voegt de tekstblokken voor en na een fetch samen, met een lege regel ertussen', () => {
    const content = [
      blok({ type: 'text', text: 'Ik haal de pagina op.', citations: null }),
      blok({ type: 'server_tool_use', id: 's1', name: 'web_fetch', input: {} }),
      blok({ type: 'text', text: 'Dit staat erin.', citations: null }),
    ]
    expect(getAllText(content)).toBe('Ik haal de pagina op.\n\nDit staat erin.')
  })
  it('geeft de fallback zonder tekstblokken', () => {
    expect(getAllText([], 'leeg')).toBe('leeg')
  })
})
