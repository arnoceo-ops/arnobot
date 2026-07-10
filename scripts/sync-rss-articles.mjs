/**
 * Haal nieuwe blogs op van arno.blog/blog?format=rss en sla ze op als .txt in data/rss_articles/.
 * Gebruik: node scripts/sync-rss-articles.mjs
 *
 * Slaat bestaande bestanden over. Veilig om herhaaldelijk te draaien.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '..', 'data', 'rss_articles')
const RSS_URL = 'https://arno.blog/blog?format=rss'

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

function extractTag(xml, tag) {
  const cdataMatch = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(xml)
  if (cdataMatch) return cdataMatch[1].trim()
  const plainMatch = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml)
  return plainMatch ? plainMatch[1].trim() : ''
}

function parseRssItems(xml) {
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
  return itemMatches.map(m => {
    const item = m[1]
    const title = extractTag(item, 'title')
    const url = extractTag(item, 'link') || extractTag(item, 'guid')
    const pubDate = extractTag(item, 'pubDate')
    const content = extractTag(item, 'content:encoded') || extractTag(item, 'description')
    return { title, url, pubDate, content }
  }).filter(i => i.url && i.title)
}

function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

function parseDate(pubDate) {
  if (!pubDate) return 'onbekend'
  try {
    const d = new Date(pubDate)
    if (isNaN(d.getTime())) return 'onbekend'
    return d.toISOString().slice(0, 10)
  } catch {
    return 'onbekend'
  }
}

async function main() {
  console.log(`RSS ophalen van ${RSS_URL}...`)

  const res = await fetch(RSS_URL, { headers: { 'User-Agent': 'ArnoBot RSS Sync/1.0' } })
  if (!res.ok) throw new Error(`RSS fetch mislukt: ${res.status}`)
  const xml = await res.text()

  const items = parseRssItems(xml)
  console.log(`${items.length} artikelen gevonden in RSS-feed\n`)

  const existing = new Set(readdirSync(OUTPUT_DIR))

  let saved = 0
  let skipped = 0

  for (const item of items) {
    const date = parseDate(item.pubDate)
    const slug = toSlug(item.title)
    const filename = `${date}_${slug}.txt`

    if (existing.has(filename)) {
      console.log(`  overgeslagen: ${filename}`)
      skipped++
      continue
    }

    const text = htmlToText(item.content)
    if (text.length < 50) {
      console.log(`  te kort, overgeslagen: ${item.title}`)
      skipped++
      continue
    }

    const fileContent = `${item.title}\n${item.url}\n${date}\n\n${text}`
    writeFileSync(join(OUTPUT_DIR, filename), fileContent, 'utf-8')
    console.log(`  opgeslagen: ${filename}`)
    saved++
  }

  console.log(`\nKlaar. ${saved} nieuw opgeslagen, ${skipped} overgeslagen.`)
  console.log(`Locatie: data/rss_articles/`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
