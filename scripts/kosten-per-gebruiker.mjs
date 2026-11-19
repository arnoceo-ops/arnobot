/**
 * Alleen-lezen overzicht van wat elke gebruiker de chat en voice kost, per kalendermaand (UTC).
 * Bron: arnobot_rds_logs (berichten, en verbruik sinds 2026-11-19 10:28 UTC) en arnobot_elevenlabs_usage.
 * Berichten zonder gelogd verbruik (ouder) worden geschat tegen het gemiddelde van de gemeten berichten
 * zonder bijlage, of $0,10 als er nog geen zijn. Niet meegerekend: analyses, sparring, samenvattingen,
 * geheugen, Voyage en andere diensten. Dit is dus een ondergrens voor wat een gebruiker kost.
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
const SCHATTING_ZONDER_METING_USD = 0.1

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

const k = (v, i, u) => ((v.invoer ?? 0) * i + (v.cache_schrijven ?? 0) * i * 1.25 + (v.cache_lezen ?? 0) * i * 0.1 + (v.uitvoer ?? 0) * u) / 1e6
const beurtKosten = v => k(v, 3, 15) + (v.lezer ? k(v.lezer, 1, 5) : 0)

const logs = await alles((van, totRij) => db.from('arnobot_rds_logs').select('user_id, created_at, verbruik')
  .gte('created_at', vanaf).lt('created_at', tot).order('id', { ascending: true }).range(van, totRij))
const voice = await alles((van, totRij) => db.from('arnobot_elevenlabs_usage').select('user_id, char_count')
  .gte('created_at', vanaf).lt('created_at', tot).order('id', { ascending: true }).range(van, totRij))

const gemeten = logs.filter(r => r.verbruik && !(r.verbruik.bijlagen > 0)).map(r => beurtKosten(r.verbruik))
const gemZonderBijlage = gemeten.length ? gemeten.reduce((s, x) => s + x, 0) / gemeten.length : SCHATTING_ZONDER_METING_USD

const perGebruiker = new Map()
for (const r of logs) {
  const g = perGebruiker.get(r.user_id) ?? { berichten: 0, gemeten: 0, gemetenUsd: 0, voiceTekens: 0 }
  g.berichten++
  if (r.verbruik) { g.gemeten++; g.gemetenUsd += beurtKosten(r.verbruik) }
  perGebruiker.set(r.user_id, g)
}
for (const r of voice) {
  const g = perGebruiker.get(r.user_id) ?? { berichten: 0, gemeten: 0, gemetenUsd: 0, voiceTekens: 0 }
  g.voiceTekens += r.char_count ?? 0
  perGebruiker.set(r.user_id, g)
}

const ids = [...perGebruiker.keys()]
const { data: gebruikers } = await db.from('approved_users').select('user_id, voornaam, plan').in('user_id', ids)
const info = new Map((gebruikers ?? []).map(u => [u.user_id, u]))

const rijen = ids.map(id => {
  const g = perGebruiker.get(id)
  const u = info.get(id)
  const geschat = (g.berichten - g.gemeten) * gemZonderBijlage
  const voiceUsd = (g.voiceTekens / 1000) * VOICE_USD_PER_1000
  const totaalUsd = g.gemetenUsd + geschat + voiceUsd
  const totaalEur = totaalUsd * USD_NAAR_EUR
  const omzet = REFERENTIE_OMZET_EUR[u?.plan] ?? null
  return {
    gebruiker: `${(u?.voornaam ?? '?').slice(0, 12)} (${id.slice(-6)})`,
    plan: u?.plan ?? '?',
    berichten: g.berichten,
    'waarvan gemeten': g.gemeten,
    'chat $': +(g.gemetenUsd + geschat).toFixed(2),
    'voice $': +voiceUsd.toFixed(2),
    'totaal $': +totaalUsd.toFixed(2),
    'totaal EUR': +totaalEur.toFixed(2),
    'omzet ref EUR': omzet,
    'marge ref EUR': omzet === null ? '-' : +(omzet - totaalEur).toFixed(2),
  }
}).sort((a, b) => b['totaal $'] - a['totaal $'])

console.log(`Maand ${maand} (UTC). Gemiddelde gemeten beurt zonder bijlage: $${gemZonderBijlage.toFixed(3)} (${gemeten.length} metingen${gemeten.length ? '' : ', nog geen: schatting $0,10'}).`)
console.table(rijen)
console.log('Let op: alleen chat en voice. Een proefperiode of een afgesproken korting maakt de omzetkolom onbetrouwbaar. Dollar naar euro tegen 0,92 (aanname).')
