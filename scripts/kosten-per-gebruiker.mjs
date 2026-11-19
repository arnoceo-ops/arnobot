/**
 * Alleen-lezen overzicht van wat elke gebruiker aan AI en spraak kost, per kalendermaand (UTC), uit arnobot_ai_gebruik (Anthropic, Voyage,
 * OpenAI-dicteren, AssemblyAI; sinds de meting van 2026-11-19) en arnobot_elevenlabs_usage (tekens). Dezelfde bron als de kolom KOSTEN MND
 * op /bot/admin/gebruikers. Onderaan staat het totaal van alle gemeten rijen, ook die zonder gebruiker (crons, admin), om te vergelijken met
 * de Anthropic-Console (Cost, workspace van productie). Rijen zonder prijs (nieuw model, embedding zonder geverifieerd tarief) worden geteld.
 * De omzet per maand is een referentie (jaarprijs: Basic 19, Pro 39, Team 49), niet de echte factuur.
 * Uitvoeren: node scripts/kosten-per-gebruiker.mjs [JJJJ-MM, standaard deze maand]
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

const USD_NAAR_EUR = 0.92 // aanname, geen live koers
const VOICE_USD_PER_1000 = 0.166
const REFERENTIE_OMZET_EUR = { basis: 19, premium: 39, team: 49 }

const maand = process.argv[2] ?? new Date().toISOString().slice(0, 7)
const [jaar, mnd] = maand.split('-').map(Number)
const vanaf = new Date(Date.UTC(jaar, mnd - 1, 1)).toISOString()
const tot = new Date(Date.UTC(jaar, mnd, 1)).toISOString()

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function alles(maakQuery) {
  const uit = []
  for (let van = 0; ; van += 1000) {
    const { data, error } = await maakQuery(van, van + 999)
    if (error) throw new Error(error.message)
    uit.push(...data)
    if (data.length < 1000) return uit
  }
}

const soort = model => !model ? 'onbekend' : model.startsWith('claude-') ? 'anthropic' : (model.startsWith('voyage') || model.startsWith('rerank')) ? 'voyage' : (model.startsWith('universal') || model.startsWith('gpt-')) ? 'audio' : 'onbekend'

const rijen = await alles((van, totRij) => db.from('arnobot_ai_gebruik').select('user_id, bron, model, kosten_usd, created_at')
  .gte('created_at', vanaf).lt('created_at', tot).order('id', { ascending: true }).range(van, totRij))
const voice = await alles((van, totRij) => db.from('arnobot_elevenlabs_usage').select('user_id, char_count')
  .gte('created_at', vanaf).lt('created_at', tot).order('id', { ascending: true }).range(van, totRij))

const perGebruiker = new Map()
const nieuw = () => ({ anthropic: 0, voyage: 0, audio: 0, voice: 0, aanroepen: 0, zonderPrijs: 0 })
let platformUsd = 0, gebruikersUsd = 0, zonderPrijsTotaal = 0
const perBron = new Map()
for (const r of rijen) {
  const usd = r.kosten_usd === null ? null : Number(r.kosten_usd)
  perBron.set(r.bron, (perBron.get(r.bron) ?? 0) + (usd ?? 0))
  if (usd === null) zonderPrijsTotaal++
  if (!r.user_id) { platformUsd += usd ?? 0; continue }
  const g = perGebruiker.get(r.user_id) ?? nieuw()
  g.aanroepen++
  if (usd === null) g.zonderPrijs++
  else { g[soort(r.model) === 'onbekend' ? 'anthropic' : soort(r.model)] += usd; gebruikersUsd += usd }
  perGebruiker.set(r.user_id, g)
}
let voiceUsdTotaal = 0
for (const v of voice) {
  if (!v.user_id) continue
  const g = perGebruiker.get(v.user_id) ?? nieuw()
  const usd = ((v.char_count ?? 0) / 1000) * VOICE_USD_PER_1000
  g.voice += usd
  voiceUsdTotaal += usd
  perGebruiker.set(v.user_id, g)
}

const ids = [...perGebruiker.keys()]
const { data: gebruikers } = await db.from('approved_users').select('user_id, voornaam, plan').in('user_id', ids)
const info = new Map((gebruikers ?? []).map(u => [u.user_id, u]))

const tabel = ids.map(id => {
  const g = perGebruiker.get(id)
  const u = info.get(id)
  const totaalUsd = g.anthropic + g.voyage + g.audio + g.voice
  const totaalEur = totaalUsd * USD_NAAR_EUR
  const omzet = REFERENTIE_OMZET_EUR[u?.plan] ?? null
  return {
    gebruiker: `${(u?.voornaam ?? '?').slice(0, 12)} (${id.slice(-6)})`,
    plan: u?.plan ?? '?',
    aanroepen: g.aanroepen,
    'Anthropic $': +g.anthropic.toFixed(3),
    'Voyage $': +g.voyage.toFixed(4),
    'audio $': +g.audio.toFixed(3),
    'voice $': +g.voice.toFixed(3),
    'totaal EUR': +totaalEur.toFixed(2),
    'marge ref EUR': omzet === null ? '-' : +(omzet - totaalEur).toFixed(2),
    'zonder prijs': g.zonderPrijs,
  }
}).sort((a, b) => b['totaal EUR'] - a['totaal EUR'])

console.log(`Maand ${maand} (UTC), ${rijen.length} gemeten aanroepen.`)
console.table(tabel)
console.log(`\nTotaal gemeten: $${(gebruikersUsd + platformUsd).toFixed(2)} (gebruikers $${gebruikersUsd.toFixed(2)}, platform zonder gebruiker $${platformUsd.toFixed(2)}) plus voice $${voiceUsdTotaal.toFixed(2)}.`)
console.log('Vergelijk dit met de Anthropic-Console (Cost, productie-workspace, zelfde maand): het verschil is wat buiten de meting valt.')
if (zonderPrijsTotaal) console.log(`${zonderPrijsTotaal} aanroepen zonder bekend tarief (staan op nul).`)
console.log('\nPer bron (dollars):')
console.table([...perBron.entries()].sort((a, b) => b[1] - a[1]).map(([bron, usd]) => ({ bron, '$': +usd.toFixed(3) })))
console.log('Let op: alleen wat gemeten wordt (sinds 2026-11-19). Een proefperiode of korting maakt de omzetkolom onbetrouwbaar. Dollar naar euro tegen 0,92 (aanname).')
