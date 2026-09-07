/**
 * Fase 1-verificatie van de voyage-4 her-embedding (docs/VOYAGE_REEMBED_PLAN.md).
 *
 * 1. Consistentiecheck: pak een steekproef bestaande chunks, embed hun exacte
 *    brontekst opnieuw met voyage-4-large, vergelijk cosine met de opgeslagen
 *    embedding_v4. Dicht bij 1,0 = de opgeslagen vectoren komen echt van dit model.
 * 2. Retrieval-vergelijking: draai een set echte salesvragen door match_blog_chunks
 *    (oud) en match_blog_chunks_v4 (nieuw), toon de top-5 bronnen naast elkaar.
 *
 * Uitvoeren: node scripts/verify-chunks-v4.mjs
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

async function embed(text, model) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ input: [text], model }),
  })
  if (!res.ok) throw new Error(`${model}: ${await res.text()}`)
  return (await res.json()).data[0].embedding
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function parseVec(v) { return typeof v === 'string' ? JSON.parse(v) : v }

// ── 1. Consistentiecheck ─────────────────────────────────────────────────────
console.log('=== Consistentiecheck: opgeslagen embedding_v4 vs verse voyage-4-large ===')
const { data: sample, error: sErr } = await supabase
  .from('blog_chunks')
  .select('id, content, context, embedding_v4')
  .not('embedding_v4', 'is', null)
  .limit(8)
if (sErr) throw new Error(sErr.message)

let minSim = 1
for (const row of sample) {
  const text = row.context ? `${row.context}\n\n${row.content}` : row.content
  const fresh = await embed(text, 'voyage-4-large')
  const sim = cosine(fresh, parseVec(row.embedding_v4))
  minSim = Math.min(minSim, sim)
  console.log(`  chunk ${row.id}: cosine = ${sim.toFixed(5)}`)
}
console.log(`  laagste cosine in de steekproef: ${minSim.toFixed(5)}  ${minSim > 0.99 ? 'OK' : 'LET OP: < 0,99'}`)

// ── 2. Retrieval-vergelijking ────────────────────────────────────────────────
const VRAGEN = [
  'Hoe ga ik om met een klant die zegt dat de prijs te hoog is?',
  'Wat is een goede opening voor een koud telefoongesprek?',
  'Hoe kwalificeer ik een lead voordat ik tijd investeer?',
  'Mijn deal is blijven hangen bij de inkoopafdeling, wat nu?',
  'Hoe bouw ik snel vertrouwen op bij een nieuwe prospect?',
  'Welke vragen stel ik in een discovery call?',
  'Hoe vraag ik om een vervolgafspraak zonder pusherig te zijn?',
  'De klant zegt dat hij erover na moet denken. Hoe reageer ik?',
  'Hoe onderhandel ik over korting zonder mijn marge weg te geven?',
  'Wat doe ik als de beslisser niet aan tafel zit?',
]

async function rerank(query, docs, topK) {
  const res = await fetch('https://api.voyageai.com/v1/rerank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query, documents: docs, model: 'rerank-2.5', top_k: topK }),
  })
  if (!res.ok) throw new Error(`rerank: ${await res.text()}`)
  const json = await res.json()
  return json.results ?? json.data
}

// Volledige pijplijn nabootsen: 100 vector-kandidaten -> rerank-2.5 -> top 10.
// Dit is de eerlijke vergelijking; de rerank zit tussen de embedding en het antwoord.
async function pipeline(vraag, model, rpc) {
  const emb = await embed(vraag, model)
  const { data } = await supabase.rpc(rpc, { query_embedding: emb, match_count: 100 })
  const cands = (data ?? []).map(r => ({ src: r.source, doc: r.context ? `${r.context}\n\n${r.content}` : r.content }))
  const reranked = await rerank(vraag, cands.map(c => c.doc), Math.min(10, cands.length))
  return reranked.map(r => cands[r.index].src)
}

console.log('\n=== Volledige pijplijn (100 kandidaten -> rerank-2.5 -> top 10) ===')
let overlapTotal = 0
for (const vraag of VRAGEN) {
  const [oud, nieuw] = await Promise.all([
    pipeline(vraag, 'voyage-3-large', 'match_blog_chunks'),
    pipeline(vraag, 'voyage-4-large', 'match_blog_chunks_v4'),
  ])
  const uniek = arr => [...new Set(arr.map(s => (s ?? '').replace(/ \(.*\)$/, '').trim()))]
  const oSet = uniek(oud), nSet = uniek(nieuw)
  const overlap = oSet.filter(s => nSet.includes(s)).length
  overlapTotal += overlap / Math.max(oSet.length, 1)
  console.log(`\n"${vraag}"`)
  console.log(`  oud  : ${oSet.join(' | ')}`)
  console.log(`  nieuw: ${nSet.join(' | ')}`)
  console.log(`  overlap unieke bronnen: ${overlap}/${oSet.length}`)
}
console.log(`\nGemiddelde bron-overlap na rerank: ${(100 * overlapTotal / VRAGEN.length).toFixed(0)}%`)
console.log('Beoordeel per vraag of de NIEUWE set even goed of beter is, niet of hij gelijk is.')
