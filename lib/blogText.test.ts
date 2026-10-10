import { describe, it, expect } from 'vitest'
import { findForbiddenDashes, normalizeTag, normalizeTags, normalizeVoornaam, slugify, isValidSlug } from './blogText'
import { renderMarkdown } from './blogMarkdown'

describe('normalizeTag', () => {
  it('maakt kleine letters zonder hekje, spaties of accenten', () => {
    expect(normalizeTag('#Sparren')).toBe('sparren')
    expect(normalizeTag('Coaching Tips!')).toBe('coachingtips')
    expect(normalizeTag('Café')).toBe('cafe')
  })
  it('geeft leeg terug bij ongeldige invoer', () => {
    expect(normalizeTag('###')).toBe('')
  })
  it('ontdubbelt en begrenst op 4 tags', () => {
    expect(normalizeTags(['a', 'A', '#a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('slug', () => {
  it('slugify en validatie', () => {
    expect(slugify('Wat is sparren? Een uitleg!')).toBe('wat-is-sparren-een-uitleg')
    expect(isValidSlug('wat-is-sparren')).toBe(true)
    expect(isValidSlug('Hoofdletter')).toBe(false)
    expect(isValidSlug('tag')).toBe(false)
    expect(isValidSlug('feed.xml')).toBe(false)
  })
})

describe('findForbiddenDashes', () => {
  it('vindt em dash, en dash en losstaand koppelteken', () => {
    expect(findForbiddenDashes('Dit \u2014 en dat')).toHaveLength(1)
    expect(findForbiddenDashes('Dit \u2013 en dat')).toHaveLength(1)
    expect(findForbiddenDashes('hij deed het - maar')).toHaveLength(1)
  })
  it('laat samengestelde woorden en markdown-syntax met rust', () => {
    expect(findForbiddenDashes('Het MT-lid en de follow-up')).toHaveLength(0)
    expect(findForbiddenDashes('- punt een\n- punt twee')).toHaveLength(0)
    expect(findForbiddenDashes('---')).toHaveLength(0)
    expect(findForbiddenDashes('| a | b |\n|---|---|\n| 1 | 2 |')).toHaveLength(0)
    expect(findForbiddenDashes('```\na - b\n```')).toHaveLength(0)
    expect(findForbiddenDashes('gebruik `a - b` zo')).toHaveLength(0)
  })
})

describe('renderMarkdown veiligheid', () => {
  it('escapet ruwe HTML en scripts', () => {
    const out = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;script&gt;')
  })
  it('blokkeert gevaarlijke link- en afbeeldingsschema\'s', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href')
    expect(renderMarkdown('[x](data:text/html;base64,AAAA)')).not.toContain('href')
    expect(renderMarkdown('![x](javascript:alert(1))')).not.toContain('<img')
    expect(renderMarkdown('![x](http://example.com/a.png)')).not.toContain('<img')
  })
  it('staat normale links en afbeeldingen toe, externe links met rel', () => {
    const out = renderMarkdown('[a](https://example.com) en [b](/prijzen) en ![c](https://example.com/a.png)')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('href="/prijzen"')
    expect(out).toContain('<img src="https://example.com/a.png"')
  })
  it('geeft koppen een anker', () => {
    expect(renderMarkdown('## Hoe werkt het')).toContain('id="hoe-werkt-het"')
  })
})

describe('normalizeVoornaam', () => {
  it('laat gewone namen intact', () => {
    expect(normalizeVoornaam('Arno')).toBe('Arno')
    expect(normalizeVoornaam('  Jan-Willem ')).toBe('Jan-Willem')
    expect(normalizeVoornaam("D'Angelo")).toBe("D'Angelo")
    expect(normalizeVoornaam('Zoë')).toBe('Zoë')
    expect(normalizeVoornaam('Anne  Marie')).toBe('Anne Marie')
  })
  it('haalt HTML en overige tekens eruit', () => {
    expect(normalizeVoornaam('<script>alert(1)</script>')).toBe('scriptalertscript')
    expect(normalizeVoornaam('Jan<b>')).toBe('Janb')
    expect(normalizeVoornaam('Piet & Klaas')).toBe('Piet Klaas')
    expect(normalizeVoornaam('x"onmouseover="y')).toBe('xonmouseovery')
  })
  it('geeft null bij leeg of zonder letters', () => {
    expect(normalizeVoornaam('')).toBeNull()
    expect(normalizeVoornaam('   ')).toBeNull()
    expect(normalizeVoornaam('123 !!')).toBeNull()
    expect(normalizeVoornaam(undefined)).toBeNull()
    expect(normalizeVoornaam(42)).toBeNull()
  })
  it('kapt af op 40 tekens', () => {
    expect(normalizeVoornaam('A'.repeat(100))?.length).toBe(40)
  })
})
