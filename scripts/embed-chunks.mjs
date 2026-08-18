/**
 * Premium indexeer-script: blogs + video kennisbank met contextual chunking.
 * Elke chunk krijgt AI-gegenereerde situating context via Claude Haiku (Anthropic-methode).
 * Uitvoeren: node scripts/embed-chunks.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Laad .env.local handmatig
const envPath = join(__dirname, '..', '.env.local')
const envVars = readFileSync(envPath, 'utf-8')
for (const line of envVars.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '')
}

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CHUNK_SIZE = 300       // Volledig argument per chunk incl. aanleiding en conclusie
const OVERLAP = 75           // 25% overlap voor continuïteit tussen chunks
const BATCH_SIZE = 8         // Voyage embeddings per request
const VOYAGE_DELAY_MS = 21000 // 3 RPM Voyage
const CONTEXT_CONCURRENCY = 10 // Parallelle Claude Haiku calls

const DATE_HEADER = /^(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})\s*$/i

// ── Blog URL lookup ───────────────────────────────────────────────────────────
const blogUrls = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'blog-urls.json'), 'utf-8')
)

function getBlogUrl(title) {
  if (blogUrls[title]) return blogUrls[title]
  const lower = title.toLowerCase()
  for (const [key, url] of Object.entries(blogUrls)) {
    if (key.toLowerCase() === lower) return url
  }
  // Fallback: strip alle niet-alfanumerieke tekens (►◄ ♛ ★ etc.) en vergelijk opnieuw
  const stripped = title.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()
  for (const [key, url] of Object.entries(blogUrls)) {
    if (key.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase() === stripped) return url
  }
  return null
}

// ── Blog parser ───────────────────────────────────────────────────────────────
function parseBlogs(text) {
  const lines = text.split('\n')
  const blogs = []
  let currentDate = null
  let currentTitle = null
  let currentLines = []
  let waitingForTitle = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (DATE_HEADER.test(trimmed)) {
      if (currentTitle && currentLines.length > 0) {
        const url = getBlogUrl(currentTitle)
        blogs.push({ source: `${currentTitle} (${currentDate})`, title: currentTitle, url, text: currentLines.join('\n').trim() })
      }
      currentDate = trimmed
      currentTitle = null
      currentLines = []
      waitingForTitle = true
      continue
    }
    if (waitingForTitle && trimmed.length > 0) {
      currentTitle = trimmed.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim()
      waitingForTitle = false
      currentLines.push(line)
      continue
    }
    currentLines.push(line)
  }
  if (currentTitle && currentLines.length > 0) {
    const url = getBlogUrl(currentTitle)
    blogs.push({ source: `${currentTitle} (${currentDate})`, title: currentTitle, url, text: currentLines.join('\n').trim() })
  }
  return blogs
}

// ── Video kennisbank parser ───────────────────────────────────────────────────
function parseVideos(text) {
  const sections = text.split(/={10,}/)
  const videos = []
  let i = 0
  while (i < sections.length) {
    const bronMatch = sections[i].match(/BRON:\s*(.+\.(?:mp3|mp4|wav|m4a))/i)
    if (bronMatch && i + 1 < sections.length) {
      const filename = bronMatch[1].trim()
      const title = filename
        .replace(/\.[^.]+$/, '')
        .replace(/^\d+_-_/, '')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .trim()
      const content = sections[i + 1].trim()
      if (content.length > 50) {
        videos.push({ source: `Video: ${title}`, title, url: null, text: content })
      }
      i += 2
    } else {
      i++
    }
  }
  return videos
}

// ── RSS artikelen parser (data/rss_articles/*.txt) ───────────────────────────
function parseRssArticles(dir, existingUrls) {
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter(f => f.endsWith('.txt')).sort()
  const articles = []
  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf-8')
    const lines = text.split('\n')
    const title = lines[0]?.trim()
    const url = lines[1]?.trim() || null
    const date = lines[2]?.trim()
    const body = lines.slice(4).join('\n').trim()
    if (!title || body.length < 50) continue
    if (url && existingUrls.has(url)) continue  // al aanwezig via CSU, geen duplicaat
    articles.push({ source: `${title} (${date})`, title, url, text: body })
  }
  return articles
}

// ── Chunking ──────────────────────────────────────────────────────────────────
function makeChunks(doc) {
  const words = doc.text.split(/\s+/).filter(Boolean)
  const chunks = []
  let i = 0
  while (i < words.length) {
    const content = words.slice(i, i + CHUNK_SIZE).join(' ')
    if (content.trim().length > 20) {
      chunks.push({ content, source: doc.source, url: doc.url ?? null, docTitle: doc.title, docText: doc.text })
    }
    i += CHUNK_SIZE - OVERLAP
  }
  return chunks
}

// ── Contextual chunking via Claude Haiku ─────────────────────────────────────
async function generateContext(chunk) {
  // Stuur max 1500 woorden van het brondocument mee als context
  const docWords = chunk.docText.split(/\s+/)
  const docSnippet = docWords.slice(0, 1500).join(' ')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `<document>
${docSnippet}
</document>

<chunk>
${chunk.content}
</chunk>

Geef in 1-2 zinnen de context van dit fragment: uit welk artikel of video het komt en wat het specifiek bespreekt. Antwoord alleen met die context, niets anders.`
      }]
    })
    return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  } catch (e) {
    console.error(`  Context generatie mislukt voor chunk: ${e.message}`)
    return `Fragment uit: ${chunk.source}`
  }
}

// Verwerk chunks in parallelle batches voor Claude
async function addContextToBatch(chunks) {
  const results = []
  for (let i = 0; i < chunks.length; i += CONTEXT_CONCURRENCY) {
    const batch = chunks.slice(i, i + CONTEXT_CONCURRENCY)
    const contexts = await Promise.all(batch.map(generateContext))
    batch.forEach((chunk, j) => {
      results.push({ ...chunk, context: contexts[j] })
    })
  }
  return results
}

// ── Voyage embeddings ─────────────────────────────────────────────────────────
async function embedBatch(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: 'voyage-3-large' }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Voyage API error: ${err}`)
  }
  const json = await res.json()
  return json.data.map(d => d.embedding)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Parse bronnen
  const blogText = readFileSync(join(__dirname, '..', 'data', 'chief_sales_updates.txt'), 'utf-8')
  const videoText = readFileSync(join(__dirname, '..', 'data', 'arnobot_video_kennisbank.txt'), 'utf-8')

  const blogs = parseBlogs(blogText)
  const videos = parseVideos(videoText)

  // RSS-artikelen: dedupliceert op URL tegen bestaande CSU-blogs
  const existingUrls = new Set(blogs.map(b => b.url).filter(Boolean))
  const rssDir = join(__dirname, '..', 'data', 'rss_articles')
  const rssArticles = parseRssArticles(rssDir, existingUrls)

  // Dit script wist en herbouwt de hele kennisbank vanuit de brontekstbestanden, dus zonder
  // deze check komt elk artikel waarvan alle chunks handmatig verwijderd zijn (admin-kennisbankpagina)
  // gewoon terug bij de eerstvolgende run. Zelfde uitsluitingstabel als de RSS-ingest cron.
  const { data: excludedRows, error: excludedError } = await supabase
    .from('arnobot_kb_excluded_urls')
    .select('url')
  if (excludedError) throw new Error(`Ophalen uitgesloten urls mislukt: ${excludedError.message}`)
  const excludedUrls = new Set((excludedRows ?? []).map(r => r.url))

  const allDocsBeforeExclusion = [...blogs, ...videos, ...rssArticles]
  const allDocs = allDocsBeforeExclusion.filter(d => !d.url || !excludedUrls.has(d.url))
  const skippedCount = allDocsBeforeExclusion.length - allDocs.length
  if (skippedCount > 0) {
    console.log(`${skippedCount} artikel(en) overgeslagen (uitgesloten via admin-kennisbankpagina)`)
  }

  console.log(`${blogs.length} blogs + ${videos.length} video's + ${rssArticles.length} RSS-artikelen gevonden`)
  const rawChunks = allDocs.flatMap(makeChunks)
  console.log(`${rawChunks.length} chunks aangemaakt. Context genereren via Claude Haiku...`)

  // Stap 1: Contextual chunking
  const contextedChunks = await addContextToBatch(rawChunks)
  console.log(`\nContext gegenereerd voor alle ${contextedChunks.length} chunks. Begin met embedden...`)

  // Stap 2: Wis bestaande data
  const { error: deleteError } = await supabase.from('blog_chunks').delete().neq('id', 0)
  if (deleteError) throw new Error(`Delete error: ${deleteError.message}`)
  console.log('Bestaande chunks gewist.')

  // Stap 3: Embed en sla op (context + content gecombineerd voor embedding)
  let inserted = 0
  for (let i = 0; i < contextedChunks.length; i += BATCH_SIZE) {
    const batch = contextedChunks.slice(i, i + BATCH_SIZE)
    // Embed: context + chunk content samen voor maximale retrieval kwaliteit
    const textsToEmbed = batch.map(c => c.context ? `${c.context}\n\n${c.content}` : c.content)
    const embeddings = await embedBatch(textsToEmbed)

    const rows = batch.map((chunk, j) => ({
      content: chunk.content,
      context: chunk.context ?? null,
      source: chunk.source,
      url: chunk.url,
      embedding: embeddings[j],
    }))
    const { error } = await supabase.from('blog_chunks').insert(rows)
    if (error) throw new Error(`Insert error: ${error.message}`)

    inserted += batch.length
    process.stdout.write(`\r${inserted}/${contextedChunks.length} chunks opgeslagen...`)

    if (i + BATCH_SIZE < contextedChunks.length) {
      await new Promise(r => setTimeout(r, VOYAGE_DELAY_MS))
    }
  }

  // Stap 4: Sla timestamp op in arnobot_meta
  const now = new Date().toISOString()
  await supabase.from('arnobot_meta').upsert([
    { key: 'last_embed_run', value: now, updated_at: now },
    { key: 'last_embed_chunks', value: String(inserted), updated_at: now },
    { key: 'last_embed_sources', value: `${blogs.length} blogs, ${videos.length} video's, ${rssArticles.length} RSS`, updated_at: now },
  ])
  console.log(`\nKlaar! Timestamp opgeslagen in arnobot_meta.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
