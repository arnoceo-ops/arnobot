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
const EMBED_BATCH = 64       // Voyage staat tot 1000 inputs/request toe
const DB_CONCURRENCY = 6     // parallelle Supabase-updates; hoger gaf "fetch failed"
const PAGE = 1000            // PostgREST geeft standaard max 1000 rijen per select terug

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

// Update met begrensde parallelliteit en per rij één retry bij een netwerkfout.
async function updateRows(items) {
  let ok = 0, failed = 0
  for (let i = 0; i < items.length; i += DB_CONCURRENCY) {
    const slice = items.slice(i, i + DB_CONCURRENCY)
    const results = await Promise.allSettled(slice.map(async ({ id, embedding_v4 }) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const { error } = await supabase.from('blog_chunks').update({ embedding_v4 }).eq('id', id)
        if (!error) return
        if (attempt === 1) throw new Error(error.message)
        await new Promise(r => setTimeout(r, 500))
      }
    }))
    for (const r of results) {
      if (r.status === 'fulfilled') ok++
      else { failed++; console.error('Update mislukt:', r.reason?.message ?? r.reason) }
    }
  }
  return { ok, failed }
}

// Alle null-rijen ophalen met paginatie (select kapt af op PAGE).
async function fetchAllNullRows() {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('blog_chunks')
      .select('id, content, context')
      .is('embedding_v4', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Ophalen mislukt: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

const rows = await fetchAllNullRows()
if (!rows.length) { console.log('Niets te doen: alle rijen hebben al een embedding_v4.'); process.exit(0) }
console.log(`${rows.length} rijen zonder embedding_v4. Embedden met ${MODEL}...`)

let totalOk = 0, totalFailed = 0
for (let i = 0; i < rows.length; i += EMBED_BATCH) {
  const batch = rows.slice(i, i + EMBED_BATCH)
  const texts = batch.map(r => (r.context ? `${r.context}\n\n${r.content}` : r.content))
  try {
    const embeddings = await embedBatch(texts)
    const { ok, failed } = await updateRows(batch.map((r, j) => ({ id: r.id, embedding_v4: embeddings[j] })))
    totalOk += ok
    totalFailed += failed
  } catch (e) {
    totalFailed += batch.length
    console.error(`Embed-batch ${i}-${i + batch.length} mislukt:`, e.message)
  }
  console.log(`${Math.min(i + EMBED_BATCH, rows.length)}/${rows.length} verwerkt (${totalOk} ok, ${totalFailed} mislukt)`)
}

console.log(`\nKlaar. ${totalOk} ok, ${totalFailed} mislukt van ${rows.length} totaal.`)
if (totalFailed > 0) { console.log('Draai het script opnieuw om de mislukte rijen alsnog te doen.'); process.exit(1) }
