/**
 * Fase 0-check voor de voyage-4 her-embedding (docs/VOYAGE_REEMBED_PLAN.md).
 * Bevestigt dat de huidige VOYAGE_API_KEY toegang heeft tot voyage-4-large en dat
 * het model 1024 dimensies teruggeeft (zodat de bestaande vector(1024)-kolommen passen).
 * Doet ook een mini cosine-check tussen voyage-3-large en voyage-4-large op dezelfde
 * tekst, puur ter illustratie dat het twee verschillende vectorruimtes zijn.
 * Uitvoeren: node scripts/check-voyage-4.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}

const KEY = process.env.VOYAGE_API_KEY
if (!KEY) { console.error('VOYAGE_API_KEY ontbreekt in .env.local'); process.exit(1) }

async function embed(text, model) {
  const t0 = Date.now()
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ input: [text], model }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${model}: ${res.status} ${JSON.stringify(body)}`)
  return { vec: body.data[0].embedding, ms: Date.now() - t0, usage: body.usage }
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

const sample = 'Hoe ga ik om met een klant die zegt dat de prijs te hoog is?'

try {
  const v4 = await embed(sample, 'voyage-4-large')
  console.log(`voyage-4-large  OK  dim=${v4.vec.length}  ${v4.ms}ms  tokens=${JSON.stringify(v4.usage)}`)
  if (v4.vec.length !== 1024) {
    console.log(`LET OP: dim is ${v4.vec.length}, niet 1024. De vector(1024)-kolommen moeten dan mee veranderen.`)
  }
  const v3 = await embed(sample, 'voyage-3-large')
  console.log(`voyage-3-large  OK  dim=${v3.vec.length}  ${v3.ms}ms`)
  console.log(`cosine(v3, v4) op dezelfde zin = ${cosine(v3.vec, v4.vec).toFixed(4)}  (laag = echt andere vectorruimte, her-embedden verplicht)`)
} catch (e) {
  console.error('FOUT:', e.message)
  process.exit(1)
}
