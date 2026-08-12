/**
 * Eenmalig reparatiescript (2026-08-12): herstelt de embedding-kolom van arnobot_blog_sessions
 * naar één consistent model. Sinds 10 juni 2026 schreef session-end/route.ts embeddings weg met
 * voyage-3-large, terwijl de rest van de sessie-geheugen-infrastructuur (sessions/route.ts,
 * sessions/embed/route.ts) sinds 11 juni voyage-multilingual-2 verwacht. Een migratie miste
 * toen één bestand. Dit script embedt alle niet-verwijderde sessies opnieuw met
 * voyage-multilingual-2 zodat de kolom weer één vectorruimte bevat.
 * Uitvoeren: node scripts/reembed-sessions.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const envVars = readFileSync(envPath, 'utf-8')
for (const line of envVars.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '')
}

const VOYAGE_BASE_URL = process.env.VOYAGE_BASE_URL ?? 'https://api.voyageai.com'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function getMultilingualEmbedding(text) {
  const res = await fetch(`${VOYAGE_BASE_URL}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: [text], model: 'voyage-multilingual-2' }),
  })
  if (!res.ok) throw new Error(`Voyage multilingual API error: ${await res.text()}`)
  const json = await res.json()
  return json.data[0].embedding
}

const { data: sessions, error } = await supabase
  .from('arnobot_blog_sessions')
  .select('session_id, title, summary, feiten')
  .is('deleted_at', null)

if (error) {
  console.error('Ophalen mislukt:', error.message)
  process.exit(1)
}

console.log(`${sessions.length} sessies om opnieuw te embedden.`)

let ok = 0
let failed = 0
const BATCH = 5
for (let i = 0; i < sessions.length; i += BATCH) {
  const batch = sessions.slice(i, i + BATCH)
  const results = await Promise.allSettled(batch.map(async s => {
    const text = [s.title, s.summary, s.feiten].filter(Boolean).join('\n')
    if (!text) throw new Error('lege tekst')
    const embedding = await getMultilingualEmbedding(text)
    const { error: updateErr } = await supabase
      .from('arnobot_blog_sessions')
      .update({ embedding })
      .eq('session_id', s.session_id)
    if (updateErr) throw new Error(updateErr.message)
  }))
  for (const r of results) {
    if (r.status === 'fulfilled') ok++
    else { failed++; console.error('Mislukt:', r.reason?.message ?? r.reason) }
  }
  console.log(`${Math.min(i + BATCH, sessions.length)}/${sessions.length} verwerkt (${ok} ok, ${failed} mislukt)`)
}

console.log(`\nKlaar. ${ok} ok, ${failed} mislukt van ${sessions.length} totaal.`)
