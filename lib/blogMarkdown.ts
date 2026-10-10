import { Marked } from 'marked'
import { slugify } from './blogText'

// Markdown naar HTML voor blogposts. Draait zowel op de server (publieke pagina) als in de
// editor (live voorbeeld), dus geen DOM-afhankelijkheid. Veiligheid zit in de renderer zelf:
// ruwe HTML in de brontekst wordt als tekst getoond i.p.v. uitgevoerd, en links en
// afbeeldingen accepteren alleen veilige URL-schema's. Zo kan een post nooit script bevatten,
// ook niet als de adminomgeving ooit misbruikt wordt.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeLink(href: string): string | null {
  const h = String(href ?? '').trim()
  if (!h) return null
  if (h.startsWith('#') || (h.startsWith('/') && !h.startsWith('//'))) return h
  try {
    const u = new URL(h)
    if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') return h
  } catch {
    return null
  }
  return null
}

function safeImage(src: string): string | null {
  const s = String(src ?? '').trim()
  if (s.startsWith('/') && !s.startsWith('//')) return s
  try {
    const u = new URL(s)
    if (u.protocol === 'https:') return s
  } catch {
    return null
  }
  return null
}

const marked = new Marked({ gfm: true, breaks: false })

marked.use({
  renderer: {
    html({ text }) {
      return escapeHtml(text)
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens)
      const safe = safeLink(href)
      if (!safe) return text
      const external = /^https?:/i.test(safe)
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      const relAttr = external ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${escapeHtml(safe)}"${titleAttr}${relAttr}>${text}</a>`
    },
    image({ href, title, text }) {
      const safe = safeImage(href)
      if (!safe) return escapeHtml(text)
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" />`
    },
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens)
      const id = slugify(inner.replace(/<[^>]*>/g, ''))
      return `<h${depth}${id ? ` id="${id}"` : ''}>${inner}</h${depth}>\n`
    },
  },
})

export function renderMarkdown(src: string): string {
  return marked.parse(String(src ?? ''), { async: false }) as string
}
