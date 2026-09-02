/**
 * Fase 1 van de voyage-4 her-embedding (docs/VOYAGE_REEMBED_PLAN.md).
 * Vult blog_chunks.embedding_v4 met voyage-4-large voor elke rij die 'm nog mist.
 * Niet-destructief: raakt embedding, content, context niet aan. Hervatbaar: draai
 * opnieuw en het pakt alleen de resterende null-rijen op.
 *
 * De te embedden tekst is exact `context + "\n\n" + content` (of alleen content),
 * identiek aan embed-chunks.mjs en aan de query-kant in lib/rag.ts. Wijkt dat af,
 * dan vergelijk je twee onvergelijkbare dingen.
 *
 * Uitvoeren: node scripts/backfill-chunks-v4.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}

const VOYAGE_BASE_URL = process.env.VOYAGE_BASE_URL ?? 'https://api.voyageai.com'
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const MODEL = 'voyage-4-large'
const BATCH_SIZE = 8         // Voyage embeddings per request
const DELAY_MS = 21000       // ruime marge onder de rate limit, zelfde als embed-chunks.mjs

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function embedBatch(texts) {
  const res = await fetch(`${VOYAGE_BASE_URL}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: MODEL }),
  })
  if (!res.ok) throw new Error(`Voyage API error: ${await res.text()}`)
  const json = await res.json()
  return json.data.map(d => d.embedding)
}

const { data: rows, error } = await supabase
  .from('blog_chunks')
  .select('id, content, context')
  .is('embedding_v4', null)

if (error) { console.error('Ophalen mislukt:', error.message); process.exit(1) }
if (!rows.length) { console.log('Niets te doen: alle rijen hebben al een embedding_v4.'); process.exit(0) }

console.log(`${rows.length} rijen zonder embedding_v4. Embedden met ${MODEL}...`)

let ok = 0
let failed = 0
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE)
  const texts = batch.map(r => (r.context ? `${r.context}\n\n${r.content}` : r.content))
  try {
    const embeddings = await embedBatch(texts)
    const updates = await Promise.allSettled(
      batch.map((r, j) =>
        supabase.from('blog_chunks').update({ embedding_v4: embeddings[j] }).eq('id', r.id)
          .then(({ error: e }) => { if (e) throw new Error(e.message) })
      )
    )
    for (const u of updates) {
      if (u.status === 'fulfilled') ok++
      else { failed++; console.error('Update mislukt:', u.reason?.message ?? u.reason) }
    }
  } catch (e) {
    failed += batch.length
    console.error(`Batch ${i}-${i + batch.length} mislukt:`, e.message)
  }
  console.log(`${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} verwerkt (${ok} ok, ${failed} mislukt)`)
  if (i + BATCH_SIZE < rows.length) await new Promise(r => setTimeout(r, DELAY_MS))
}

console.log(`\nKlaar. ${ok} ok, ${failed} mislukt van ${rows.length} totaal.`)
if (failed > 0) { console.log('Draai het script opnieuw om de mislukte rijen alsnog te doen.'); process.exit(1) }
