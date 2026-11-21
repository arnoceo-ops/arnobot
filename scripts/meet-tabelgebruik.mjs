/**
 * Alleen-lezen meting van het tabelgebruik in de hoofdchat (2026-11-21), uit arnobot_rds_logs.verbruik.tools (sinds de deploy van
 * commit "toolaanroepen in verbruik"). Beantwoordt gratis (geen AI-aanroepen): hoe vaak gaat een beurt met een bijlage langs de
 * tabeltool, welke kolommen worden gevraagd, en hoe vaak komt een beurt met een bijlage zonder toolaanroep terug.
 * Uitvoeren: node scripts/meet-tabelgebruik.mjs [dagen, standaard 7]
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const envPad = join(import.meta.dirname, '..', '.env.local')
if (existsSync(envPad)) {
  for (const line of readFileSync(envPad, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dagen = Number(process.argv[2] ?? 7)
const sinds = new Date(Date.now() - dagen * 864e5).toISOString()
const { data, error } = await s.from('arnobot_rds_logs').select('created_at, verbruik').gte('created_at', sinds).not('verbruik', 'is', null).limit(5000)
if (error) { console.error(error.message); process.exit(1) }

const metTools = data.filter(r => Array.isArray(r.verbruik?.tools))
const metBijlage = data.filter(r => (r.verbruik?.bijlagen ?? 0) > 0)
const bijlageMetMeting = metBijlage.filter(r => 'tools' in r.verbruik || r.created_at >= (metTools[0]?.created_at ?? '9'))
const zonderTool = bijlageMetMeting.filter(r => !r.verbruik.tools || r.verbruik.tools.length === 0)
const kolommen = new Map()
let tabelVragen = 0
for (const r of metTools) for (const t of r.verbruik.tools) {
  if (t.naam !== 'tabel_vraag') continue
  tabelVragen++
  try { const k = JSON.parse(t.invoer).kolom; kolommen.set(k, (kolommen.get(k) ?? 0) + 1) } catch { /* ingekorte invoer */ }
}
console.log(`Beurten met verbruik in de laatste ${dagen} dagen: ${data.length}`)
console.log(`Beurten met bijlage: ${metBijlage.length}`)
console.log(`Sinds de meting van toolaanroepen (${metTools[0]?.created_at ?? 'nog geen'}): ${bijlageMetMeting.length} beurten met bijlage, waarvan ${zonderTool.length} zonder toolaanroep`)
console.log(`Aanroepen van tabel_vraag: ${tabelVragen}`)
for (const [k, n] of [...kolommen].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}x ${k}`)
