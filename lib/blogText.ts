// Pure tekstfuncties voor de blog. Geen server-afhankelijkheden, dus zowel de editor
// (client) als de server gebruiken exact dezelfde regels.

export const MAX_TAGS = 4
export const MAX_TAG_LENGTH = 30

// Eerste padsegment onder /blog dat een eigen route heeft. Een post mag zo niet heten.
export const RESERVED_SLUGS = ['tag', 'feed.xml', 'bevestig', 'afmelden', 'page']

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Hashtag: kleine letters en cijfers, geen spaties of leestekens. "#Sparren" en "sparren"
// worden dezelfde tag. Leeg resultaat = ongeldig.
export function normalizeTag(raw: string): string {
  return stripAccents(String(raw ?? ''))
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, MAX_TAG_LENGTH)
}

export function normalizeTags(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  for (const item of list) {
    const tag = normalizeTag(String(item))
    if (tag && !out.includes(tag)) out.push(tag)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

export function slugify(title: string): string {
  return stripAccents(String(title ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 80 && !RESERVED_SLUGS.includes(slug)
}

// Streepjesregel uit CLAUDE.md: geen em dash, geen en dash en geen losstaand koppelteken
// als leesteken. Markdown-syntax blijft toegestaan: lijstmarkeringen aan het begin van een
// regel, tabelscheidingen, horizontale lijnen, codeblokken en inline code worden overgeslagen.
export function findForbiddenDashes(text: string): string[] {
  const hits: string[] = []
  const withoutFences = String(text ?? '').replace(/```[\s\S]*?```/g, '')
  for (const rawLine of withoutFences.split('\n')) {
    const line = rawLine.replace(/`[^`]*`/g, '')
    if (/^\s*[|:\-\s]+$/.test(line)) continue
    const idx = line.search(/[—–]|(\S)\s-\s(\S)/)
    if (idx >= 0) hits.push(line.trim().slice(Math.max(0, idx - 20), idx + 30))
  }
  return hits
}

export function readingMinutes(bodyMd: string): number {
  const words = String(bodyMd ?? '').trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}
