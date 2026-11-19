/**
 * Alleen-lezen controle van de documentlezer (lib/documentLezer.ts) in productie: raakt de cache?
 * Leest arnobot_rds_logs.verbruik.lezer, per beurt: tijd, pauze sinds de vorige lezerbeurt van dezelfde
 * gebruiker, en hoeveel invoer uit de cache kwam. Sluit met een overzicht per pauzelengte, zodat
 * zichtbaar wordt of een cache van 1 uur (2x schrijven) iets zou opleveren boven de 5 minuten.
 * Uitvoeren: node scripts/check-lezer-cache.mjs [dagen, standaard 7]
 */
import { readFileSync, existsSync } from 'fs'
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

const dagen = Number(process.argv[2]) || 7
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const vanaf = new Date(Date.now() - dagen * 86_400_000).toISOString()

const { data, error } = await db.from('arnobot_rds_logs')
  .select('user_id, created_at, verbruik')
  .gte('created_at', vanaf)
  .not('verbruik->lezer', 'is', null)
  .order('created_at', { ascending: true })
  .limit(5000)
if (error) { console.error('Database-fout:', error.message); process.exit(1) }

const beurten = (data ?? []).filter(r => r.verbruik?.lezer)
if (beurten.length === 0) { console.log(`Geen lezerbeurten in de laatste ${dagen} dagen.`); process.exit(0) }

const vorige = new Map()
const rijen = beurten.map(r => {
  const t = new Date(r.created_at).getTime()
  const pauzeMin = vorige.has(r.user_id) ? (t - vorige.get(r.user_id)) / 60_000 : null
  vorige.set(r.user_id, t)
  const l = r.verbruik.lezer
  const totaalIn = (l.invoer ?? 0) + (l.cache_schrijven ?? 0) + (l.cache_lezen ?? 0)
  return { gebruiker: r.user_id.slice(-6), tijd: r.created_at.slice(0, 16).replace('T', ' '), pauzeMin, invoer: l.invoer ?? 0, schrijven: l.cache_schrijven ?? 0, lezen: l.cache_lezen ?? 0, aanroepen: l.aanroepen ?? 0, aandeelCache: totaalIn ? (l.cache_lezen ?? 0) / totaalIn : 0 }
})

console.table(rijen.map(r => ({
  gebruiker: r.gebruiker, tijd: r.tijd, 'pauze (min)': r.pauzeMin === null ? '-' : r.pauzeMin.toFixed(1),
  invoer: r.invoer, 'cache schrijven': r.schrijven, 'cache lezen': r.lezen, aanroepen: r.aanroepen, 'uit cache': `${Math.round(r.aandeelCache * 100)}%`,
})))

const groepen = [
  ['eerste beurt (geen vorige)', r => r.pauzeMin === null],
  ['pauze onder 5 min', r => r.pauzeMin !== null && r.pauzeMin < 5],
  ['pauze 5 tot 60 min', r => r.pauzeMin !== null && r.pauzeMin >= 5 && r.pauzeMin < 60],
  ['pauze 60 min of meer', r => r.pauzeMin !== null && r.pauzeMin >= 60],
]
console.log('\nOverzicht per pauzelengte (vervolgbeurten horen onder 5 min flink uit de cache te komen):')
for (const [naam, test] of groepen) {
  const g = rijen.filter(test)
  const gem = g.length ? Math.round(g.reduce((s, r) => s + r.aandeelCache, 0) / g.length * 100) : 0
  console.log(`  ${naam}: ${g.length} beurten, gemiddeld ${gem}% uit cache`)
}
console.log('\nLees zo: veel beurten in "5 tot 60 min" met een laag cachepercentage = een cache van 1 uur zou daar geld besparen.')
