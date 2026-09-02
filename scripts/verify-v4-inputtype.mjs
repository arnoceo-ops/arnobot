/**
 * Test of input_type ("query"/"document") de retrieval-kwaliteit van voyage-4-large
 * merkbaar verandert. Voyage raadt dit aan; de huidige code (en de eerste backfill)
 * gebruikt het niet. We embedden een set kandidaten vers met en zonder input_type en
 * vergelijken de rerank-top voor een paar vragen.
 *
 * Uitvoeren: node scripts/verify-v4-inputtype.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}
const KEY = process.env.VOYAGE_API_KEY
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function embedMany(texts, model, inputType) {
  const body = { input: texts, model }
  if (inputType) body.input_type = inputType
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()).data.map(d => d.embedding)
}
async function rerank(query, docs, topK) {
  const res = await fetch('https://api.voyageai.com/v1/rerank', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query, documents: docs, model: 'rerank-2.5', top_k: topK }),
  })
  const json = await res.json()
  return json.results ?? json.data
}
function cos(a, b) { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i] } return d / Math.sqrt(x * y) }

// Haal een brede kandidatenpool op (alle chunks zou kunnen, maar 600 is genoeg voor de test).
const { data: rows } = await supabase.from('blog_chunks').select('content, context, source').limit(600)
const docs = rows.map(r => (r.context ? `${r.context}\n\n${r.content}` : r.content))
const srcs = rows.map(r => (r.source ?? '').replace(/ \(.*\)$/, '').trim())

console.log(`Embed ${docs.length} kandidaten met voyage-4-large, met en zonder input_type=document...`)
const docEmbPlain = []
const docEmbTyped = []
for (let i = 0; i < docs.length; i += 100) {
  docEmbPlain.push(...await embedMany(docs.slice(i, i + 100), 'voyage-4-large', null))
  docEmbTyped.push(...await embedMany(docs.slice(i, i + 100), 'voyage-4-large', 'document'))
}

const VRAGEN = [
  'Hoe ga ik om met een klant die zegt dat de prijs te hoog is?',
  'Welke vragen stel ik in een discovery call?',
  'Hoe vraag ik om een vervolgafspraak zonder pusherig te zijn?',
  'De klant zegt dat hij erover na moet denken. Hoe reageer ik?',
]

function topN(qEmb, docEmb, n) {
  return docEmb.map((d, i) => ({ i, s: cos(qEmb, d) })).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.i)
}

for (const vraag of VRAGEN) {
  const qPlain = (await embedMany([vraag], 'voyage-4-large', null))[0]
  const qTyped = (await embedMany([vraag], 'voyage-4-large', 'query'))[0]
  const candPlain = topN(qPlain, docEmbPlain, 40)
  const candTyped = topN(qTyped, docEmbTyped, 40)
  const rPlain = (await rerank(vraag, candPlain.map(i => docs[i]), 5)).map(r => srcs[candPlain[r.index]])
  const rTyped = (await rerank(vraag, candTyped.map(i => docs[i]), 5)).map(r => srcs[candTyped[r.index]])
  console.log(`\n"${vraag}"`)
  console.log(`  zonder input_type: ${[...new Set(rPlain)].join(' | ')}`)
  console.log(`  met input_type   : ${[...new Set(rTyped)].join(' | ')}`)
}
