export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { notifyCronFailure } from '@/lib/cron-notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const RSS_URL = 'https://arno.blog/blog?format=rss'
const CHUNK_SIZE = 200
const OVERLAP = 50
const MAX_NEW_PER_RUN = 5

// ── RSS parsing ───────────────────────────────────────────────────────────────
function extractTag(xml: string, tag: string): string {
  const cdataMatch = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(xml)
  if (cdataMatch) return cdataMatch[1].trim()
  const plainMatch = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml)
  return plainMatch ? plainMatch[1].trim() : ''
}

function parseRssItems(xml: string): { title: string; url: string; content: string }[] {
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
  return itemMatches.map(m => {
    const item = m[1]
    const title = extractTag(item, 'title')
    const url = extractTag(item, 'link') || extractTag(item, 'guid')
    const content = extractTag(item, 'content:encoded') || extractTag(item, 'description')
    return { title, url, content }
  }).filter(i => i.url && i.title)
}

// ── HTML → plain text ─────────────────────────────────────────────────────────
function htmlToText(html: string): string {
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

// ── Chunking (zelfde logica als embed-chunks.mjs) ─────────────────────────────
function makeChunks(text: string, source: string, url: string): { content: string; source: string; url: string; docText: string }[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: { content: string; source: string; url: string; docText: string }[] = []
  let i = 0
  while (i < words.length) {
    const content = words.slice(i, i + CHUNK_SIZE).join(' ')
    if (content.trim().length > 20) {
      chunks.push({ content, source, url, docText: text })
    }
    i += CHUNK_SIZE - OVERLAP
  }
  return chunks
}

// ── Contextuele chunking via Claude Haiku ─────────────────────────────────────
async function addContext(chunk: { content: string; source: string; url: string; docText: string }): Promise<{ content: string; context: string; source: string; url: string }> {
  const docSnippet = chunk.docText.split(/\s+/).slice(0, 1500).join(' ')
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `<document>\n${docSnippet}\n</document>\n\n<chunk>\n${chunk.content}\n</chunk>\n\nGeef in 1-2 zinnen de context van dit fragment: uit welk artikel het komt en wat het specifiek bespreekt. Antwoord alleen met die context, niets anders.`,
      }],
    })
    const context = res.content[0].type === 'text' ? res.content[0].text.trim() : `Fragment uit: ${chunk.source}`
    return { content: chunk.content, context, source: chunk.source, url: chunk.url }
  } catch {
    return { content: chunk.content, context: `Fragment uit: ${chunk.source}`, source: chunk.source, url: chunk.url }
  }
}

// ── Voyage embeddings ─────────────────────────────────────────────────────────
async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: 'voyage-3' }),
  })
  if (!res.ok) throw new Error(`Voyage API error: ${await res.text()}`)
  const json = await res.json()
  return json.data.map((d: { embedding: number[] }) => d.embedding)
}

// ── Cron handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. RSS ophalen
    const rssRes = await fetch(RSS_URL, { headers: { 'User-Agent': 'ArnoBot RSS Ingest/1.0' } })
    if (!rssRes.ok) throw new Error(`RSS fetch mislukt: ${rssRes.status}`)
    const rssXml = await rssRes.text()
    const items = parseRssItems(rssXml)
    if (items.length === 0) return NextResponse.json({ ok: true, new: 0, message: 'Geen items in RSS' })

    // 2. Welke URLs bestaan al in blog_chunks?
    const urls = items.map(i => i.url)
    const { data: existing } = await supabase
      .from('blog_chunks')
      .select('url')
      .in('url', urls)
    const existingUrls = new Set((existing ?? []).map(r => r.url))

    const newItems = items.filter(i => !existingUrls.has(i.url)).slice(0, MAX_NEW_PER_RUN)
    if (newItems.length === 0) return NextResponse.json({ ok: true, new: 0, message: 'Geen nieuwe artikelen' })

    // 3. Nieuwe artikelen verwerken
    let totalInserted = 0
    for (const item of newItems) {
      const text = htmlToText(item.content)
      if (text.length < 100) continue

      const source = `${item.title}`
      const rawChunks = makeChunks(text, source, item.url)
      if (rawChunks.length === 0) continue

      // Context toevoegen (5 parallel)
      const contextedChunks: { content: string; context: string; source: string; url: string }[] = []
      for (let i = 0; i < rawChunks.length; i += 5) {
        const batch = rawChunks.slice(i, i + 5)
        const results = await Promise.all(batch.map(addContext))
        contextedChunks.push(...results)
      }

      // Embedden (8 per batch, met rate-limit pauze)
      const BATCH_SIZE = 8
      for (let i = 0; i < contextedChunks.length; i += BATCH_SIZE) {
        const batch = contextedChunks.slice(i, i + BATCH_SIZE)
        const texts = batch.map(c => c.context ? `${c.context}\n\n${c.content}` : c.content)
        const embeddings = await embedBatch(texts)

        const rows = batch.map((chunk, j) => ({
          content: chunk.content,
          context: chunk.context,
          source: chunk.source,
          url: chunk.url,
          embedding: embeddings[j],
        }))
        const { error } = await supabase.from('blog_chunks').insert(rows)
        if (error) throw new Error(`Insert error: ${error.message}`)
        totalInserted += rows.length

        if (i + BATCH_SIZE < contextedChunks.length) {
          await new Promise(r => setTimeout(r, 21000))
        }
      }
    }

    // 4. Telegram notificatie bij nieuwe artikelen
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (token && chatId && newItems.length > 0) {
      const titels = newItems.map(i => `• ${i.title}`).join('\n')
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `ArnoBot kennisbank bijgewerkt\n\n${newItems.length} nieuw${newItems.length > 1 ? 'e artikelen' : ' artikel'} geindexeerd:\n${titels}\n\n${totalInserted} chunks toegevoegd.`,
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, new: newItems.length, chunks: totalInserted })
  } catch (err) {
    await notifyCronFailure('rss-ingest', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
