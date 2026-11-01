/**
 * Controleert dat elk markdown-document in docs/kennisbank/ ook echt in de kennisbank
 * (tabel blog_chunks) staat. Een bestand in die map komt niet vanzelf in de kennisbank, het moet
 * apart worden ingeladen met scripts/embed-single-doc.mjs (bron-label "Kennisbank: <titel>").
 * Aanleiding: op 2026-11-01 bleken twee van de vier documenten nooit te zijn ingeladen, waardoor
 * ArnoBot ze niet kon vinden.
 *
 * Een document telt als ingeladen als zijn titel (de H1) begint met het deel na "Kennisbank: " van
 * een bron in de database. Zet de exitcode op 1 met een lijst van wat ontbreekt.
 * Uitvoeren: node scripts/check-kennisbank-sync.mjs (vereist NEXT_PUBLIC_SUPABASE_URL en
 * SUPABASE_SERVICE_ROLE_KEY in de omgeving, of in .env.local).
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envPad = join(ROOT, '.env.local')
if (existsSync(envPad)) {
  for (const line of readFileSync(envPad, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const norm = t => t.toLowerCase().replace(/[^a-z0-9à-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim()
const map = join(ROOT, 'docs', 'kennisbank')
const documenten = readdirSync(map).filter(f => f.endsWith('.md')).map(f => {
  const h1 = readFileSync(join(map, f), 'utf8').split(/\r?\n/).find(l => l.startsWith('# '))
  return { bestand: f, titel: h1 ? norm(h1.slice(2)) : null }
})

async function controleer() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken, controle niet mogelijk.')
    return false
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await supabase.from('blog_chunks').select('source').ilike('source', 'Kennisbank:%')
  if (error) {
    console.error('Database-fout:', error.message)
    return false
  }
  const labels = [...new Set((data ?? []).map(r => norm(r.source.replace(/^Kennisbank:\s*/i, ''))))]
  const ontbreekt = documenten.filter(d => !d.titel || !labels.some(l => d.titel.startsWith(l)))
  console.log(`${documenten.length} documenten in docs/kennisbank/, ${labels.length} bronnen in de kennisbank.`)
  if (ontbreekt.length > 0) {
    console.error('\nNiet ingeladen in de kennisbank:')
    for (const d of ontbreekt) console.error(`  ${d.bestand}${d.titel ? '' : ' (geen titel op regel "# ...")'}`)
    console.error('\nLaad ze in met: node scripts/embed-single-doc.mjs docs/kennisbank/<bestand> "Kennisbank: <titel>"')
    return false
  }
  console.log('OK: alle documenten staan in de kennisbank.')
  return true
}

// exitCode i.p.v. process.exit: op Windows geeft een abrupte exit met open verbindingen een
// libuv-melding. Hier netjes uitlopen.
process.exitCode = (await controleer()) ? 0 : 1
