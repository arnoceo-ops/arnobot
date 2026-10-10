import { describe, it, expect } from 'vitest'
import { getEmailTemplate } from './email-templates'

const blog = {
  titel: 'Wat is sparren?',
  samenvatting: 'Een korte uitleg.',
  url: 'https://www.arno.bot/blog/wat-is-sparren',
  afmeldUrl: 'https://www.arno.bot/blog/afmelden/abc',
  voorkeurenUrl: 'https://www.arno.bot/blog/voorkeuren/abc',
}

describe('blogmails', () => {
  it('toont de aanhef met voornaam, in beide mails', () => {
    expect(getEmailTemplate('blog_bevestiging', 'Arno', false, { blog }).html).toContain('Hey, Arno.')
    expect(getEmailTemplate('blog_nieuwe_post', 'Arno', false, { blog }).html).toContain('Hey, Arno.')
  })

  it('heeft geen aanhef zonder voornaam', () => {
    expect(getEmailTemplate('blog_bevestiging', '', false, { blog }).html).not.toContain('Hey,')
    expect(getEmailTemplate('blog_nieuwe_post', '', false, { blog }).html).not.toContain('Hey,')
  })

  it('escapet titel en samenvatting in de artikelmail', () => {
    const { html } = getEmailTemplate('blog_nieuwe_post', '', false, {
      blog: { ...blog, titel: '<img src=x onerror=alert(1)>', samenvatting: 'a & b <script>' },
    })
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('a &amp; b &lt;script&gt;')
  })

  it('bevat afmeld- en voorkeurenlink in de artikelmail en de bevestiglink in de bevestiging', () => {
    const post = getEmailTemplate('blog_nieuwe_post', '', false, { blog }).html
    expect(post).toContain(blog.afmeldUrl)
    expect(post).toContain(blog.voorkeurenUrl)
    expect(post).toContain(blog.url)
    const confirm = getEmailTemplate('blog_bevestiging', '', false, { blog: { ...blog, url: 'https://www.arno.bot/blog/bevestig/tok' } }).html
    expect(confirm).toContain('https://www.arno.bot/blog/bevestig/tok')
  })

  it('gebruikt de onderwerpregel uit de teksten en de artikeltitel', () => {
    expect(getEmailTemplate('blog_bevestiging', '', false, { blog }).subject).toBe('Bevestig je aanmelding voor de ArnoBot blog')
    expect(getEmailTemplate('blog_nieuwe_post', '', false, { blog }).subject).toBe('Wat is sparren?')
  })

  it('bevat geen streepjes als leesteken in de mailteksten', () => {
    for (const type of ['blog_bevestiging', 'blog_nieuwe_post'] as const) {
      const html = getEmailTemplate(type, 'Arno', false, { blog }).html
      expect(html).not.toMatch(/[—–]/)
    }
  })
})
