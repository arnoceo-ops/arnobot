/**
 * Eenmalig: meta-analyse (zelfbeoordeling + expertpanel) met de ECHTE productiecode van
 * lib/metaAnalyse.ts, eenmaal met claude-fable-5-2 en eenmaal met claude-opus-5-5.
 * Het model wordt alleen in het uitgaande API-verzoek vervangen. Leest alleen uit Supabase,
 * schrijft niets weg. Output: data/meta-blind.md (A/B) en data/meta-sleutel.md.
 *
 * Uitvoeren: npx --yes tsx scripts/test-meta-fable52-vs-opus55.ts
 */
import { readFileSync, writeFileSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
}

let modelOverride = ''
const origFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init: any) => {
  if (modelOverride && typeof init?.body === 'string' && init.body.includes('"claude-fable-5-1"')) {
    init = { ...init, body: init.body.replaceAll('"claude-fable-5-1"', `"${modelOverride}"`) }
  }
  return origFetch(input, init)
}) as typeof fetch

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { runMetaAnalyse } = await import('../lib/metaAnalyse')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const runs: Record<string, any> = {}
  for (const model of ['claude-fable-5-2', 'claude-opus-5-5']) {
    modelOverride = model
    console.log('Meta-analyse met', model)
    runs[model] = await runMetaAnalyse(supabase as any, { days: 30 })
  }

  const swap = Math.random() < 0.5
  const [a, b] = swap ? ['claude-opus-5-5', 'claude-fable-5-2'] : ['claude-fable-5-2', 'claude-opus-5-5']
  const dump = (r: any) => '```json\n' + JSON.stringify(r, null, 2) + '\n```'
  writeFileSync('data/meta-blind.md', `# Blinde vergelijking meta-analyse\n\n## A\n${dump(runs[a])}\n\n## B\n${dump(runs[b])}\n`)
  writeFileSync('data/meta-sleutel.md', `A = ${a}\nB = ${b}\n`)
  console.log('Klaar: data/meta-blind.md')
}
main().catch(e => { console.error(e); process.exit(1) })
