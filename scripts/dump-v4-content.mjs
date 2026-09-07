/**
 * Schrijft de inhoud van de top-5 chunks (na rerank) naast elkaar weg voor
 * voyage-3-large en voyage-4-large, zodat Arno op inhoud kan beoordelen of de
 * nieuwe retrieval even goed of beter is. Output: scripts/v4-content-vergelijking.md
 * Uitvoeren: node scripts/dump-v4-content.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
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
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ input: [text], model }),
  })
  return (await res.json()).data[0].embedding
}
async function rerank(query, docs, topK) {
  const res = await fetch('https://api.voyageai.com/v1/rerank', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query, documents: docs, model: 'rerank-2.5', top_k: topK }),
  })
  const j = await res.json()
  return j.results ?? j.data
}
async function pipeline(vraag, model, rpc) {
  const emb = await embed(vraag, model)
  const { data } = await supabase.rpc(rpc, { query_embedding: emb, match_count: 100 })
  const cands = (data ?? []).map(r => ({ src: r.source, content: r.content }))
  const rr = await rerank(vraag, cands.map(c => c.content), Math.min(5, cands.length))
  return rr.map(r => ({ src: cands[r.index].src, content: cands[r.index].content }))
}

const VRAGEN = [
  'Hoe ga ik om met een klant die zegt dat de prijs te hoog is?',
  'Welke vragen stel ik in een discovery call?',
  'Hoe vraag ik om een vervolgafspraak zonder pusherig te zijn?',
  'De klant zegt dat hij erover na moet denken. Hoe reageer ik?',
]

let out = '# voyage-3-large vs voyage-4-large: inhoud van de top-5 chunks na rerank\n'
for (const vraag of VRAGEN) {
  const [oud, nieuw] = await Promise.all([
    pipeline(vraag, 'voyage-3-large', 'match_blog_chunks'),
    pipeline(vraag, 'voyage-4-large', 'match_blog_chunks_v4'),
  ])
  out += `\n\n## ${vraag}\n\n### OUD (voyage-3-large)\n`
  oud.forEach((c, i) => { out += `\n**${i + 1}. ${c.src}**\n\n${c.content.slice(0, 700)}\n` })
  out += `\n### NIEUW (voyage-4-large)\n`
  nieuw.forEach((c, i) => { out += `\n**${i + 1}. ${c.src}**\n\n${c.content.slice(0, 700)}\n` })
}
writeFileSync(join(__dirname, 'v4-content-vergelijking.md'), out)
console.log('geschreven naar scripts/v4-content-vergelijking.md')
