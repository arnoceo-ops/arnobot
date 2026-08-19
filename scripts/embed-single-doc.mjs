/**
 * Eenmalig script: voeg één los kennisbankdocument toe aan blog_chunks, zonder de
 * bestaande kennisbank te wissen (in tegenstelling tot embed-chunks.mjs, dat de hele
 * kennisbank herbouwt vanuit de brontekstbestanden). Zelfde chunking/context/embedding-
 * pipeline (contextual chunking via Claude Haiku, embeddings via voyage-3-large),
 * toegepast op één markdown-bestand.
 * Uitvoeren: node scripts/embed-single-doc.mjs <pad-naar-markdown-bestand> "<source-label>"
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

const CHUNK_SIZE = 300
const OVERLAP = 75
const BATCH_SIZE = 8

const filePath = process.argv[2]
const sourceLabel = process.argv[3]
if (!filePath || !sourceLabel) {
  console.error('Gebruik: node scripts/embed-single-doc.mjs <pad-naar-markdown-bestand> "<source-label>"')
  process.exit(1)
}

function stripMarkdown(text) {
  return text
    .split('\n')
    .map(line => line.replace(/^#+\s*/, ''))
    .join('\n')
    .trim()
}

function makeChunks(text, source) {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks = []
  let i = 0
  while (i < words.length) {
    const content = words.slice(i, i + CHUNK_SIZE).join(' ')
    if (content.trim().length > 20) {
      chunks.push({ content, source, docText: text })
    }
    i += CHUNK_SIZE - OVERLAP
  }
  return chunks
}

async function generateContext(chunk) {
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

Geef in 1-2 zinnen de context van dit fragment: uit welk artikel het komt en wat het specifiek bespreekt. Antwoord alleen met die context, niets anders.`
      }]
    })
    return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  } catch (e) {
    console.error(`  Context generatie mislukt voor chunk: ${e.message}`)
    return `Fragment uit: ${chunk.source}`
  }
}

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

async function main() {
  const raw = readFileSync(filePath, 'utf-8')
  const text = stripMarkdown(raw)

  const rawChunks = makeChunks(text, sourceLabel)
  console.log(`${rawChunks.length} chunks aangemaakt voor "${sourceLabel}". Context genereren via Claude Haiku...`)

  const contextedChunks = []
  for (const chunk of rawChunks) {
    const context = await generateContext(chunk)
    contextedChunks.push({ ...chunk, context })
  }
  console.log('Context gegenereerd. Begin met embedden...')

  let inserted = 0
  for (let i = 0; i < contextedChunks.length; i += BATCH_SIZE) {
    const batch = contextedChunks.slice(i, i + BATCH_SIZE)
    const textsToEmbed = batch.map(c => c.context ? `${c.context}\n\n${c.content}` : c.content)
    const embeddings = await embedBatch(textsToEmbed)

    const rows = batch.map((chunk, j) => ({
      content: chunk.content,
      context: chunk.context ?? null,
      source: chunk.source,
      url: null,
      embedding: embeddings[j],
    }))
    const { error } = await supabase.from('blog_chunks').insert(rows)
    if (error) throw new Error(`Insert error: ${error.message}`)

    inserted += batch.length
    console.log(`${inserted}/${contextedChunks.length} chunks opgeslagen...`)
  }

  console.log(`\nKlaar. ${inserted} chunk(s) toegevoegd aan blog_chunks voor "${sourceLabel}".`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
